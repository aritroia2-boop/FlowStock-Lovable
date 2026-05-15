import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.84.0';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const SYSTEM_PROMPT = `Extract Romanian invoice data.
- Supplier: company name from header (e.g. "SC X SRL"), pick the topmost.
- Items: only real product line items from the table. Skip transport, ambalaj, taxă, discount, livrare, TVA, total, subtotal.
- Use exact names as written. Each item needs name, quantity, unit, unit_price.
- Currency: ISO 4217 (lei/RON->RON, €->EUR, $->USD, £->GBP). Default RON if unclear.`;

const TOOL = {
  type: 'function',
  function: {
    name: 'extract_invoice_data',
    description: 'Extract supplier and product line items from invoice',
    parameters: {
      type: 'object',
      properties: {
        supplier: {
          type: 'object',
          properties: { name: { type: 'string' } },
          required: ['name'],
        },
        currency: { type: 'string', description: 'ISO 4217 code, default RON' },
        items: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              name: { type: 'string' },
              quantity: { type: 'number' },
              unit: { type: 'string' },
              unit_price: { type: 'number' },
            },
            required: ['name', 'quantity', 'unit', 'unit_price'],
          },
        },
      },
      required: ['supplier', 'items', 'currency'],
    },
  },
};

const IRRELEVANT = ['transport', 'ambalaj', 'taxa', 'taxă', 'discount', 'livrare', 'tva', 'total', 'subtotal', 'shipping'];

async function callAI(apiKey: string, model: string, fileUrl: string, catalogHint: string) {
  const userText = catalogHint
    ? `Extract supplier and items. Existing catalog (reuse these names when they match): ${catalogHint}`
    : 'Extract supplier and all product items from this invoice.';

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
    const nameLower = String(item.name || '').toLowerCase();
    if (!nameLower) continue;
    if (IRRELEVANT.some((k) => nameLower.includes(k))) continue;
    const key = `${nameLower.trim()}|${item.quantity}`;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(item);
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

    // Mark processing (don't await — fire and forget for speed)
    supabase.from('orders').update({ status: 'processing' }).eq('id', orderId).then(() => {});

    // Get a signed URL instead of downloading + base64
    const storagePath = fileUrl.split('/order-invoices/')[1];
    if (!storagePath) throw new Error('Invalid fileUrl');

    const { data: signed, error: signErr } = await supabase.storage
      .from('order-invoices')
      .createSignedUrl(storagePath, 600);
    if (signErr || !signed?.signedUrl) {
      throw new Error(`Failed to sign invoice URL: ${signErr?.message || 'unknown'}`);
    }

    // Build catalog hint from order's user/restaurant ingredients
    const { data: orderRow } = await supabase
      .from('orders')
      .select('user_id, restaurant_id')
      .eq('id', orderId)
      .single();

    let catalogHint = '';
    if (orderRow) {
      const ingQuery = supabase.from('ingredients').select('name').limit(200);
      if (orderRow.restaurant_id) {
        ingQuery.eq('restaurant_id', orderRow.restaurant_id);
      } else if (orderRow.user_id) {
        ingQuery.eq('owner_id', orderRow.user_id);
      }
      const { data: ings } = await ingQuery;
      if (ings?.length) catalogHint = ings.map((i: any) => i.name).join(', ');
    }

    // Try fast model first, fall back to pro if it returns nothing usable
    console.log('Calling fast model...');
    let extracted: any;
    try {
      extracted = await callAI(lovableApiKey, 'google/gemini-3-flash-preview', signed.signedUrl, catalogHint);
      if (!extracted?.items?.length) throw new Error('flash returned 0 items');
    } catch (flashErr) {
      console.warn('Flash failed, falling back to pro:', flashErr);
      extracted = await callAI(lovableApiKey, 'google/gemini-2.5-pro', signed.signedUrl, catalogHint);
    }

    const cleaned = cleanItems(extracted.items || []);
    if (cleaned.length === 0) throw new Error('No valid items after filtering');

    const KNOWN = new Set(['RON', 'EUR', 'USD', 'GBP', 'MDL', 'CHF', 'PLN', 'HUF', 'BGN', 'CZK']);
    const aliasMap: Record<string, string> = { LEI: 'RON', '€': 'EUR', $: 'USD', '£': 'GBP' };
    const rawCur = String(extracted.currency || '').trim().toUpperCase();
    const currency = aliasMap[rawCur] || (KNOWN.has(rawCur) ? rawCur : 'RON');

    const supplierName = extracted.supplier?.name || 'Unknown Supplier';

    const orderItems = cleaned.map((item: any) => ({
      order_id: orderId,
      ingredient_name: item.name,
      quantity: item.quantity,
      unit: item.unit,
      price_per_unit: item.unit_price || 0,
      currency,
      needs_confirmation: true,
      is_new_ingredient: false,
    }));

    // Parallel writes
    const [updateRes, insertRes] = await Promise.all([
      supabase.from('orders').update({
        status: 'processed',
        supplier: supplierName,
        currency,
        extracted_data: {
          supplier: extracted.supplier,
          currency,
          items: cleaned,
          extracted_at: new Date().toISOString(),
        },
      }).eq('id', orderId),
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
