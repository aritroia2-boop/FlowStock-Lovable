import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.84.0';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { fileUrl, orderId } = await req.json();

    if (!fileUrl || !orderId) {
      throw new Error('Missing fileUrl or orderId');
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const lovableApiKey = Deno.env.get('LOVABLE_API_KEY');

    if (!lovableApiKey) {
      throw new Error('LOVABLE_API_KEY not configured');
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Update order status to processing
    await supabase
      .from('orders')
      .update({ status: 'processing' })
      .eq('id', orderId);

    console.log('Downloading invoice from:', fileUrl);

    // Download the PDF from storage
    const { data: fileData, error: downloadError } = await supabase.storage
      .from('order-invoices')
      .download(fileUrl.split('/order-invoices/')[1]);

    if (downloadError) {
      console.error('Error downloading file:', downloadError);
      throw new Error(`Failed to download invoice: ${downloadError.message}`);
    }

    // Convert to base64
    const bytes = await fileData.arrayBuffer();
    const base64 = btoa(String.fromCharCode(...new Uint8Array(bytes)));

    console.log('Sending to AI for extraction...');

    // Call Lovable AI with structured extraction
    const aiResponse = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${lovableApiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'google/gemini-2.5-pro',
        messages: [
          {
            role: 'system',
            content: `You are a Romanian invoice data extraction expert. Extract ONLY actual products from the invoice table.

CRITICAL RULES:
1. Extract supplier from header using patterns: "SC ___ SRL", "S.R.L.", "Furnizor:", "Emitent:", "Denumire firmă:"
2. Extract ONLY line items from the product/item table section
3. DO NOT generate, invent, or expand the product list
4. Exclude: transport, ambalaj, taxă, discount, livrare, TVA, total
5. Use exact item names as written on invoice
6. Each item MUST have: name, quantity, unit, unit_price
7. If multiple company names appear, choose the one at the top of the invoice
8. Ignore addresses, CUI numbers, phone numbers in supplier detection`
          },
          {
            role: 'user',
            content: [
              {
                type: 'text',
                text: 'Extract the supplier and all product items from this Romanian invoice. Return only real products from the table, with exact names and quantities.'
              },
              {
                type: 'image_url',
                image_url: {
                  url: `data:application/pdf;base64,${base64}`
                }
              }
            ]
          }
        ],
        tools: [
          {
            type: 'function',
            function: {
              name: 'extract_invoice_data',
              description: 'Extract structured invoice data including supplier and product items',
              parameters: {
                type: 'object',
                properties: {
                  supplier: {
                    type: 'object',
                    properties: {
                      name: { 
                        type: 'string',
                        description: 'Company name from invoice header (e.g., SC HERBALROM SRL)'
                      }
                    },
                    required: ['name']
                  },
                  items: {
                    type: 'array',
                    description: 'ONLY products from the invoice table. Do NOT invent items.',
                    items: {
                      type: 'object',
                      properties: {
                        name: { 
                          type: 'string',
                          description: 'Exact product name as written on invoice'
                        },
                        quantity: { 
                          type: 'number',
                          description: 'Quantity ordered'
                        },
                        unit: { 
                          type: 'string',
                          description: 'Unit of measurement (kg, g, ml, l, buc, etc.)'
                        },
                        unit_price: { 
                          type: 'number',
                          description: 'Price per unit'
                        },
                        total_price: {
                          type: 'number',
                          description: 'Total price for this line item'
                        }
                      },
                      required: ['name', 'quantity', 'unit', 'unit_price']
                    }
                  }
                },
                required: ['supplier', 'items']
              }
            }
          }
        ],
        tool_choice: { 
          type: 'function', 
          function: { name: 'extract_invoice_data' } 
        }
      }),
    });

    if (!aiResponse.ok) {
      const errorText = await aiResponse.text();
      console.error('AI API error:', aiResponse.status, errorText);
      throw new Error(`AI extraction failed: ${errorText}`);
    }

    const aiData = await aiResponse.json();
    console.log('AI response:', JSON.stringify(aiData, null, 2));

    // Extract the tool call result
    const toolCall = aiData.choices?.[0]?.message?.tool_calls?.[0];
    if (!toolCall || toolCall.function.name !== 'extract_invoice_data') {
      throw new Error('AI did not return structured data');
    }

    const extractedData = JSON.parse(toolCall.function.arguments);
    console.log('Extracted data:', JSON.stringify(extractedData, null, 2));

    // Post-processing: Remove irrelevant items and duplicates
    const irrelevantKeywords = [
      'transport', 'ambalaj', 'taxa', 'taxă', 'discount', 
      'livrare', 'tva', 'total', 'subtotal', 'shipping'
    ];

    const cleanedItems = extractedData.items
      .filter((item: any) => {
        // Remove items without price or quantity
        if (!item.unit_price || !item.quantity || item.quantity <= 0) {
          console.log('Filtering out item without price/quantity:', item.name);
          return false;
        }

        // Remove irrelevant items
        const nameLower = item.name.toLowerCase();
        if (irrelevantKeywords.some(keyword => nameLower.includes(keyword))) {
          console.log('Filtering out irrelevant item:', item.name);
          return false;
        }

        return true;
      })
      // Deduplicate by name + quantity
      .filter((item: any, index: number, self: any[]) => {
        return index === self.findIndex(t => 
          t.name.toLowerCase().trim() === item.name.toLowerCase().trim() && 
          t.quantity === item.quantity
        );
      });

    console.log(`Cleaned items: ${cleanedItems.length} items (from ${extractedData.items.length} original)`);

    if (cleanedItems.length === 0) {
      throw new Error('No valid items found in invoice after filtering');
    }

    // Update order with extracted data
    const supplierName = extractedData.supplier?.name || 'Unknown Supplier';

    await supabase
      .from('orders')
      .update({
        status: 'processed',
        supplier: supplierName,
        extracted_data: {
          supplier: extractedData.supplier,
          items: cleanedItems,
          extracted_at: new Date().toISOString()
        }
      })
      .eq('id', orderId);

    // Insert order items
    const orderItems = cleanedItems.map((item: any) => ({
      order_id: orderId,
      ingredient_name: item.name,
      quantity: item.quantity,
      unit: item.unit,
      price_per_unit: item.unit_price || 0,
      needs_confirmation: true,
      is_new_ingredient: false
    }));

    const { error: itemsError } = await supabase
      .from('order_items')
      .insert(orderItems);

    if (itemsError) {
      console.error('Error inserting order items:', itemsError);
      throw itemsError;
    }

    console.log(`Successfully extracted ${cleanedItems.length} items from invoice`);

    return new Response(
      JSON.stringify({
        success: true,
        supplier: supplierName,
        itemsExtracted: cleanedItems.length
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Error processing invoice:', error);

    // Update order status to error
    if (req.json && (await req.json()).orderId) {
      const { orderId } = await req.json();
      const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
      const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
      const supabase = createClient(supabaseUrl, supabaseServiceKey);

      await supabase
        .from('orders')
        .update({
          status: 'error',
          error_message: error instanceof Error ? error.message : 'Unknown error'
        })
        .eq('id', orderId);
    }

    return new Response(
      JSON.stringify({
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    );
  }
});
