export const config = {
  runtime: 'edge',
};

export default async function handler(req) {
  try {
    if (req.method !== 'POST') {
      return new Response(JSON.stringify({ error: 'Method not allowed' }), {
        status: 405,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    const { prompt, mode } = await req.json();
    const HUGGINGFACE_API_KEY = process.env.HUGGINGFACE_API_KEY;

    if (!HUGGINGFACE_API_KEY) {
      return new Response(JSON.stringify({ error: 'API key not configured' }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    if (mode === 'text') {
      // Text generation remains unchanged
      const enhancedPrompt = `You are an empathetic and kind storyteller. Write a emotionally healing and warm story about: ${prompt}. Tell the story naturally, treating the human's feelings as fragile`;
      
      const response = await fetch('https://api-inference.huggingface.co/models/google/gemma-7b', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${HUGGINGFACE_API_KEY}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          inputs: enhancedPrompt,
          parameters: {
            max_new_tokens: 500,
            temperature: 0.7,
            top_p: 0.95,
            do_sample: true,
            return_full_text: false
          }
        }),
      });

      if (!response.ok) {
        throw new Error(`Hugging Face API error: ${response.status}`);
      }

      const data = await response.json();
      
      if (Array.isArray(data) && data[0]?.generated_text) {
        let cleanedText = data[0].generated_text
          .replace(/Step \d+\/\d+/g, '')
          .replace(/^\d+[\.)]/gm, '')
          .replace(/^Q:|^A:/gm, '')
          .replace(/^Question:|^Answer:/gm, '')
          .replace(/^[-*•]/gm, '')
          .replace(/^(Here is|Below is|This is).*(example|response).*\n/gi, '')
          .replace(/In (Hindi|English|Spanish|French|German):/gi, '')
          .replace(/\n\s*\n/g, '\n')
          .replace(/\s+/g, ' ')
          .trim();

        cleanedText = cleanedText
          .split(/\n/)
          .filter(line => line.trim().length > 0)
          .map(line => line.trim())
          .join(' ');

        if (!cleanedText.match(/[.!?]$/)) {
          cleanedText += '.';
        }

        data[0].generated_text = cleanedText;
      }

      return new Response(JSON.stringify(data), {
        headers: { 
          'Content-Type': 'application/json',
          'Cache-Control': 'no-cache'
        },
      });
    } else {
      // Create a 4-panel comic strip sequence
      const panels = [];
      const comicPrompts = [
        `comic panel 1 of 4: ${prompt}, emotional and touching scene, warm colors, gentle expressions, comic book style, clean lines`,
        `comic panel 2 of 4: ${prompt} continued, character development, emotional depth, soft lighting, comic art style`,
        `comic panel 3 of 4: ${prompt} emotional peak, heartwarming moment, detailed expressions, comic illustration`,
        `comic panel 4 of 4: ${prompt} resolution, touching finale, tender moment, emotional impact, comic strip style`
      ];

      for (const panelPrompt of comicPrompts) {
        const response = await fetch('https://api-inference.huggingface.co/models/stabilityai/stable-diffusion-xl-base-1.0', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${HUGGINGFACE_API_KEY}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ 
            inputs: panelPrompt,
            parameters: {
              guidance_scale: 8.5,  // Increased for better prompt adherence
              num_inference_steps: 50,
              negative_prompt: "text, words, speech bubbles, blurry, distorted, low quality"
            }
          }),
        });

        if (!response.ok) {
          throw new Error(`Image generation failed for panel: ${response.status}`);
        }

        const imageData = await response.arrayBuffer();
        panels.push(Buffer.from(imageData).toString('base64'));
      }

      return new Response(JSON.stringify({ panels }), {
        headers: { 
          'Content-Type': 'application/json',
          'Cache-Control': 'public, max-age=31536000'
        },
      });
    }
  } catch (error) {
    console.error('API Error:', error);
    return new Response(JSON.stringify({ 
      error: `Generation failed: ${error.message}` 
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
}
