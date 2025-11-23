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
    
    console.log('Processing invoice:', { fileUrl, orderId });

    // Initialize Supabase client
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Update order status to processing
    await supabase
      .from('orders')
      .update({ status: 'processing' })
      .eq('id', orderId);

    // Download PDF from storage
    const pdfPath = fileUrl.split('/order-invoices/')[1];
    const { data: pdfData, error: downloadError } = await supabase.storage
      .from('order-invoices')
      .download(pdfPath);

    if (downloadError) throw new Error(`Failed to download PDF: ${downloadError.message}`);

    // Convert PDF to base64 for AI processing
    const arrayBuffer = await pdfData.arrayBuffer();
    const base64Pdf = btoa(String.fromCharCode(...new Uint8Array(arrayBuffer)));

    // Use Lovable AI to extract ingredients
    const lovableApiKey = Deno.env.get('LOVABLE_API_KEY');
    if (!lovableApiKey) throw new Error('LOVABLE_API_KEY not configured');

    const aiResponse = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${lovableApiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'google/gemini-2.5-flash',
        messages: [
          {
            role: 'system',
            content: `You are an AI assistant that extracts ingredient information from supplier invoices in Romanian.
Extract ONLY food ingredients and their quantities. Ignore non-food items like boxes, containers, services, etc.

Return a JSON array with this exact structure:
[
  {
    "name": "ingredient name in Romanian",
    "quantity": number,
    "unit": "kg|g|L|ml|buc|cutie|pachet|etc",
    "price_per_unit": number (optional),
    "supplier": "supplier name" (optional)
  }
]

Rules:
- Convert all quantities to base units (kg, g, L, ml, buc)
- If quantity includes weight in item name (e.g., "Mozzarella 500g"), extract it
- Normalize similar ingredient names (e.g., "Mozzarella 45%" → "Mozzarella")
- Return ONLY the JSON array, no other text
- If you cannot extract data, return empty array []`
          },
          {
            role: 'user',
            content: `Extract ingredients from this PDF invoice. The PDF is base64 encoded:\n\n${base64Pdf.substring(0, 50000)}`
          }
        ],
        temperature: 0.2,
      }),
    });

    if (!aiResponse.ok) {
      const errorText = await aiResponse.text();
      console.error('AI extraction error:', errorText);
      throw new Error(`AI extraction failed: ${errorText}`);
    }

    const aiData = await aiResponse.json();
    const extractedText = aiData.choices[0].message.content;
    
    console.log('AI extracted text:', extractedText);

    // Parse JSON from AI response
    let extractedIngredients = [];
    try {
      // Try to extract JSON from response (AI might add explanation text)
      const jsonMatch = extractedText.match(/\[[\s\S]*\]/);
      if (jsonMatch) {
        extractedIngredients = JSON.parse(jsonMatch[0]);
      } else {
        throw new Error('No JSON array found in AI response');
      }
    } catch (parseError) {
      console.error('JSON parse error:', parseError);
      throw new Error('Failed to parse AI response as JSON');
    }

    // Validate extracted data
    if (!Array.isArray(extractedIngredients)) {
      throw new Error('AI response is not an array');
    }

    // Update order with extracted data
    await supabase
      .from('orders')
      .update({
        status: 'processed',
        extracted_data: extractedIngredients,
        supplier: extractedIngredients[0]?.supplier || null
      })
      .eq('id', orderId);

    // Create order items
    const orderItems = extractedIngredients.map((item: any) => ({
      order_id: orderId,
      ingredient_name: item.name,
      quantity: item.quantity,
      unit: item.unit,
      price_per_unit: item.price_per_unit || 0,
      needs_confirmation: true,
      is_new_ingredient: false
    }));

    if (orderItems.length > 0) {
      await supabase
        .from('order_items')
        .insert(orderItems);
    }

    console.log('Successfully processed invoice:', orderId);

    return new Response(
      JSON.stringify({ 
        success: true, 
        extractedIngredients: extractedIngredients.length 
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Error processing invoice:', error);
    
    // Update order status to error
    try {
      const body = await req.json();
      const { orderId } = body;
      const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
      const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
      const supabase = createClient(supabaseUrl, supabaseKey);
      
      await supabase
        .from('orders')
        .update({
          status: 'error',
          error_message: error instanceof Error ? error.message : 'Unknown error'
        })
        .eq('id', orderId);
    } catch (updateError) {
      console.error('Failed to update error status:', updateError);
    }

    return new Response(
      JSON.stringify({ 
        error: error instanceof Error ? error.message : 'Unknown error' 
      }),
      { 
        status: 500, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );
  }
});
