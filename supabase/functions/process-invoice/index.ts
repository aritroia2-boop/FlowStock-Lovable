import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { encodeBase64 } from "https://deno.land/std@0.224.0/encoding/base64.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.84.0';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const SYSTEM_PROMPT = `You are an invoice extractor for a HoReCa restaurant inventory system.
Extract ONLY real product line items. Output exactly what is needed for inventory matching.

STRICT RULES:
- KEEP attribute info inside the product name: fat % ("Lapte 4.5%"), protein %, brand, packaging size, type. NEVER strip these.
- Also fill the structured "attributes" object: fat_pct (number), protein_pct (number), brand (string), packaging_size (string e.g. "1L", "500g"), type (string e.g. "UHT", "extra virgin").
- Set "normalized_name" = clean product name without supplier slogans, marketing text, or stock-keeping codes, but WITH attributes preserved.
- IGNORE / DO NOT EMIT as items: marketing words ("premium", "ofertă", "promoție", "promotion", "best quality", "nou", "calitate superioară"), brand slogans, headers, footers, transport, ambalaj, taxă, discount, livrare, shipping, TVA, total, subtotal, page numbers.
- ALWAYS extract the actual invoice unit_price (even if discounted). Compute total_price_line = quantity * unit_price when missing.
- Currency: ISO 4217 (lei/RON->RON, €->EUR, $->USD, £->GBP). Default RON.
- invoice_date: YYYY-MM-DD if visible, else null.
- Supplier: company name from the header (e.g. "SC X SRL"), the topmost one.`;

const TOOL = {
  type: 'function',
  function: {
    name: 'extract_invoice_data',
    description: 'Extract supplier, date, currency and product line items from an invoice',
    parameters: {
      type: 'object',
      properties: {
        supplier: {
          type: 'object',
          properties: { name: { type: 'string' } },
          required: ['name'],
        },
        invoice_date: { type: 'string', description: 'YYYY-MM-DD or empty' },
        currency: { type: 'string', description: 'ISO 4217 code, default RON' },
        items: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              product_name_raw: { type: 'string', description: 'Exact text as written on the invoice' },
              normalized_name: { type: 'string', description: 'Cleaned name with attributes preserved' },
              attributes: {
                type: 'object',
                properties: {
                  fat_pct: { type: 'number' },
                  protein_pct: { type: 'number' },
                  brand: { type: 'string' },
                  packaging_size: { type: 'string' },
                  type: { type: 'string' },
                },
              },
              quantity: { type: 'number' },
              unit: { type: 'string' },
              unit_price: { type: 'number' },
              total_price_line: { type: 'number' },
            },
            required: ['product_name_raw', 'normalized_name', 'quantity', 'unit', 'unit_price'],
          },
        },
      },
      required: ['supplier', 'items', 'currency'],
    },
  },
};

const IRRELEVANT = [
  'transport', 'ambalaj', 'taxa', 'taxă', 'discount', 'livrare', 'tva', 'total', 'subtotal', 'shipping',
  'premium', 'ofertă', 'oferta', 'promoție', 'promotie', 'promotion', 'best quality', 'calitate superioară',
];

async function callAI(apiKey: string, model: string, fileUrl: string, catalogHint: string) {
  const userText = catalogHint
    ? `Extract supplier, invoice_date, currency and items. When a product matches one of these existing catalog entries, set normalized_name to match the catalog name exactly (preserve attributes). Existing catalog: ${catalogHint}`
    : 'Extract supplier, invoice_date, currency and all product items from this invoice.';

  const res = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
    method: 'POST',
    headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model,
      messages: [
        { role: 'system', content: SYSTEM_PROMPT },
        {
          role: 'user',
          content: [
            { type: 'text', text: userText },
            { type: 'image_url', image_url: { url: fileUrl } },
          ],
        },
      ],
      tools: [TOOL],
      tool_choice: { type: 'function', function: { name: 'extract_invoice_data' } },
    }),
  });

  if (!res.ok) {
    const t = await res.text();
    throw new Error(`AI ${model} ${res.status}: ${t}`);
  }
  const data = await res.json();
  const tc = data.choices?.[0]?.message?.tool_calls?.[0];
  if (!tc || tc.function.name !== 'extract_invoice_data') {
    throw new Error('No structured data returned');
  }
  return JSON.parse(tc.function.arguments);
}

function cleanItems(items: any[]): any[] {
  const seen = new Set<string>();
  const out: any[] = [];
  for (const item of items || []) {
    if (!item?.unit_price || !item?.quantity || item.quantity <= 0) continue;
    const rawName = String(item.product_name_raw || item.name || '').trim();
    const normalized = String(item.normalized_name || rawName).trim();
    if (!normalized) continue;
    const lower = normalized.toLowerCase();
    if (IRRELEVANT.some((k) => lower.includes(k))) continue;
    const key = `${lower}|${item.quantity}`;
    if (seen.has(key)) continue;
    seen.add(key);

    const total = item.total_price_line && item.total_price_line > 0
      ? item.total_price_line
      : Number((item.quantity * item.unit_price).toFixed(2));

    out.push({
      product_name_raw: rawName || normalized,
      normalized_name: normalized,
      attributes: item.attributes || {},
      quantity: item.quantity,
      unit: String(item.unit || 'buc').trim(),
      unit_price: item.unit_price,
      total_price_line: total,
    });
  }
  return out;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  let orderId: string | undefined;
  let supabase: ReturnType<typeof createClient> | undefined;

  try {
    const body = await req.json();
    const fileUrl: string = body.fileUrl;
    orderId = body.orderId;

    if (!fileUrl || !orderId) throw new Error('Missing fileUrl or orderId');

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const lovableApiKey = Deno.env.get('LOVABLE_API_KEY');
    if (!lovableApiKey) throw new Error('LOVABLE_API_KEY not configured');

    supabase = createClient(supabaseUrl, supabaseServiceKey);

    supabase.from('orders').update({ status: 'processing' }).eq('id', orderId).then(() => {});

    const storagePath = fileUrl.split('/order-invoices/')[1];
    if (!storagePath) throw new Error('Invalid fileUrl');

    const { data: signed, error: signErr } = await supabase.storage
      .from('order-invoices')
      .createSignedUrl(storagePath, 600);
    if (signErr || !signed?.signedUrl) {
      throw new Error(`Failed to sign invoice URL: ${signErr?.message || 'unknown'}`);
    }

    // Fetch file bytes and convert to a base64 data URL with the proper MIME.
    // Gemini rejects remote .pdf URLs but accepts inline data URLs.
    const ext = storagePath.split('.').pop()?.toLowerCase() || '';
    const mimeMap: Record<string, string> = {
      pdf: 'application/pdf',
      png: 'image/png',
      jpg: 'image/jpeg',
      jpeg: 'image/jpeg',
      webp: 'image/webp',
      gif: 'image/gif',
    };
    const mime = mimeMap[ext] || 'application/octet-stream';

    const fileRes = await fetch(signed.signedUrl);
    if (!fileRes.ok) throw new Error(`Failed to download invoice: ${fileRes.status}`);
    const fileBuf = new Uint8Array(await fileRes.arrayBuffer());
    const MAX_BYTES = 15 * 1024 * 1024;
    if (fileBuf.byteLength > MAX_BYTES) {
      throw new Error(`Invoice file too large (${(fileBuf.byteLength / 1024 / 1024).toFixed(1)}MB). Please upload a file under 15MB.`);
    }
    // Encode in chunks to avoid call-stack overflow on large files
    let binary = '';
    const CHUNK = 0x8000;
    for (let i = 0; i < fileBuf.length; i += CHUNK) {
      binary += String.fromCharCode(...fileBuf.subarray(i, i + CHUNK));
    }
    const dataUrl = `data:${mime};base64,${btoa(binary)}`;

    // Catalog hint: include attributes for better semantic matching
    const { data: orderRow } = await supabase
      .from('orders')
      .select('user_id, restaurant_id')
      .eq('id', orderId)
      .single();

    let catalogHint = '';
    if (orderRow) {
      const ingQuery = supabase.from('ingredients').select('name, attributes').limit(200);
      if (orderRow.restaurant_id) {
        ingQuery.eq('restaurant_id', orderRow.restaurant_id);
      } else if (orderRow.user_id) {
        ingQuery.eq('owner_id', orderRow.user_id);
      }
      const { data: ings } = await ingQuery;
      if (ings?.length) {
        catalogHint = ings.map((i: any) => {
          const attr = i.attributes && Object.keys(i.attributes).length
            ? ` [${Object.entries(i.attributes).map(([k, v]) => `${k}:${v}`).join(', ')}]`
            : '';
          return `${i.name}${attr}`;
        }).join('; ');
      }
    }

    console.log('Calling fast model...');
    let extracted: any;
    try {
      extracted = await callAI(lovableApiKey, 'google/gemini-3-flash-preview', dataUrl, catalogHint);
      if (!extracted?.items?.length) throw new Error('flash returned 0 items');
    } catch (flashErr) {
      console.warn('Flash failed, falling back to pro:', flashErr);
      extracted = await callAI(lovableApiKey, 'google/gemini-2.5-pro', dataUrl, catalogHint);
    }

    const cleaned = cleanItems(extracted.items || []);
    if (cleaned.length === 0) throw new Error('No valid items after filtering');

    const KNOWN = new Set(['RON', 'EUR', 'USD', 'GBP', 'MDL', 'CHF', 'PLN', 'HUF', 'BGN', 'CZK']);
    const aliasMap: Record<string, string> = { LEI: 'RON', '€': 'EUR', $: 'USD', '£': 'GBP' };
    const rawCur = String(extracted.currency || '').trim().toUpperCase();
    const currency = aliasMap[rawCur] || (KNOWN.has(rawCur) ? rawCur : 'RON');

    const supplierName = extracted.supplier?.name || 'Unknown Supplier';
    const invoiceDate = (() => {
      const d = String(extracted.invoice_date || '').trim();
      return /^\d{4}-\d{2}-\d{2}$/.test(d) ? d : null;
    })();

    const orderItems = cleaned.map((item: any) => ({
      order_id: orderId,
      ingredient_name: item.normalized_name,
      normalized_name: item.normalized_name,
      attributes: item.attributes || {},
      quantity: item.quantity,
      unit: item.unit,
      price_per_unit: item.unit_price || 0,
      invoice_unit_price: item.unit_price || 0,
      total_price_line: item.total_price_line,
      currency,
      needs_confirmation: true,
      is_new_ingredient: false,
    }));

    const orderUpdate: any = {
      status: 'processed',
      supplier: supplierName,
      currency,
      extracted_data: {
        supplier: extracted.supplier,
        invoice_date: invoiceDate,
        currency,
        items: cleaned,
        extracted_at: new Date().toISOString(),
      },
    };
    if (invoiceDate) orderUpdate.invoice_date = invoiceDate;

    const [updateRes, insertRes] = await Promise.all([
      supabase.from('orders').update(orderUpdate).eq('id', orderId),
      supabase.from('order_items').insert(orderItems),
    ]);

    if (insertRes.error) throw insertRes.error;
    if (updateRes.error) throw updateRes.error;

    console.log(`Extracted ${cleaned.length} items from invoice`);

    return new Response(
      JSON.stringify({ success: true, supplier: supplierName, itemsExtracted: cleaned.length }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('Error processing invoice:', error);

    if (orderId && supabase) {
      await supabase
        .from('orders')
        .update({
          status: 'error',
          error_message: error instanceof Error ? error.message : 'Unknown error',
        })
        .eq('id', orderId);
    }

    return new Response(
      JSON.stringify({ success: false, error: error instanceof Error ? error.message : 'Unknown error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
