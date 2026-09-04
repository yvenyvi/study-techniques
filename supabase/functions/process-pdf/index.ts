// @ts-nocheck
import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.7.1'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const { filePath } = await req.json()

    if (!filePath) {
      return new Response(
        JSON.stringify({ error: 'filePath is required' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
      )
    }

    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      { global: { headers: { Authorization: req.headers.get('Authorization')! } } }
    )

    // 1. Download the PDF from Supabase Storage
    const { data: fileData, error: downloadError } = await supabaseClient.storage
      .from('pdfs')
      .download(filePath)

    if (downloadError) throw downloadError

    // Convert blob to base64 securely and efficiently using chunks
    const arrayBuffer = await fileData.arrayBuffer();
    const bytes = new Uint8Array(arrayBuffer);
    let binary = '';
    const chunkSize = 10000;
    for (let i = 0; i < bytes.length; i += chunkSize) {
      binary += String.fromCharCode.apply(null, bytes.subarray(i, i + chunkSize));
    }
    const base64Data = btoa(binary);

    // 2. Call Gemini API
    const geminiApiKey = Deno.env.get('GEMINI_API_KEY');
    if (!geminiApiKey) {
        throw new Error('GEMINI_API_KEY is not set in the Edge Function environment');
    }

    const geminiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-3.6-flash:generateContent?key=${geminiApiKey}`;

    const prompt = `You are a document formatting assistant. Your ONLY job is to extract the EXACT text from the provided PDF and reformat it into clean, structured HTML. 

CRITICAL RULES:
- DO NOT summarize, paraphrase, or omit ANY text. Transfer every single word from the original document.
- DO NOT add your own explanations or commentary.
- The PDF likely comes from presentation slides (PPT). Each slide's content should be treated as a section.

FORMAT the output as raw HTML (no markdown code blocks) using these rules:
1. Use <h3> for slide titles or main headings found in the document.
2. Use <h4> for sub-headings within a slide.
3. Use <ul>/<li> for bullet points and <ol>/<li> for numbered lists, preserving the original structure.
4. Use <strong> for any bold text found in the original.
5. Use <em> for any italic text found in the original.
6. Wrap each slide/section content in a <div class="slide-section"> tag.
7. Separate each slide/section with an <hr> tag.
8. Keep the output clean and directly usable within a web page's innerHTML.
9. Preserve the exact order of content as it appears in the document.`;

    const geminiResponse = await fetch(geminiUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        contents: [{
          parts: [
            { text: prompt },
            {
              inline_data: {
                mime_type: 'application/pdf',
                data: base64Data
              }
            }
          ]
        }]
      })
    });

    if (!geminiResponse.ok) {
      const errorText = await geminiResponse.text();
      throw new Error(`Gemini API Error: ${errorText}`);
    }

    const geminiData = await geminiResponse.json();
    let notesHtml = geminiData.candidates[0].content.parts[0].text;

    // Remove markdown code blocks if the model included them
    notesHtml = notesHtml.replace(/^```html\n/i, '').replace(/```$/i, '');

    return new Response(
      JSON.stringify({ notesHtml }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
    )

  } catch (error: any) {
    return new Response(
      JSON.stringify({ error: error.message, stack: error.stack }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
    )
  }
})
