import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const body = await req.json();
    const texts = body.texts;
    const targetLang = body.targetLang || body.target_lang;
    const mode = body.mode || "neutral"; // formal, neutral, informal
    const fullTranslation = body.fullTranslation || false; // for translator page: includes alternatives, transliteration
    const sourceLang = body.sourceLang || "auto";

    if (!texts || !targetLang) {
      return new Response(JSON.stringify({ error: "texts and targetLang required" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY not configured");

    const textArray = Array.isArray(texts) ? texts : [texts];

    // For full translation mode (translator page), use richer prompt
    if (fullTranslation) {
      const modeDesc = mode === "formal" ? "formal/professional register" : mode === "informal" ? "casual/informal register" : "neutral register";
      const sourceDesc = sourceLang === "auto" ? "Auto-detect the source language" : `Source language: ${sourceLang}`;
      const prompt = `${sourceDesc}. Translate the following text to ${targetLang} using ${modeDesc}. The translation should sound natural, as if written by a native speaker. Preserve meaning, tone, emotion, and cultural context.\n\nText:\n${textArray[0]}`;

      const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${LOVABLE_API_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: "google/gemini-3-flash-preview",
          messages: [
            { role: "system", content: "You are a world-class professional translator. Provide accurate, natural, contextually appropriate translations. Detect idioms, slang, technical terms, and translate them appropriately." },
            { role: "user", content: prompt },
          ],
          tools: [{
            type: "function",
            function: {
              name: "return_full_translation",
              description: "Return complete translation with extras",
              parameters: {
                type: "object",
                properties: {
                  detected_language: { type: "string", description: "ISO 639-1 code of detected source language" },
                  translation: { type: "string", description: "Main translation" },
                  alternatives: { type: "array", items: { type: "string" }, description: "2-3 alternative translations" },
                  transliteration: { type: "string", description: "Transliteration/romanization if target uses non-Latin script, otherwise empty" },
                  pronunciation: { type: "string", description: "Pronunciation guide if applicable, otherwise empty" },
                },
                required: ["detected_language", "translation", "alternatives"],
                additionalProperties: false,
              }
            }
          }],
          tool_choice: { type: "function", function: { name: "return_full_translation" } },
        }),
      });

      if (!response.ok) {
        if (response.status === 429) return new Response(JSON.stringify({ error: "Rate limited" }), { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } });
        if (response.status === 402) return new Response(JSON.stringify({ error: "Credits exhausted" }), { status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" } });
        throw new Error(`AI error: ${response.status}`);
      }

      const data = await response.json();
      const toolCall = data.choices?.[0]?.message?.tool_calls?.[0];
      if (toolCall?.function?.arguments) {
        const parsed = JSON.parse(toolCall.function.arguments);
        return new Response(JSON.stringify(parsed), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      throw new Error("No tool call response");
    }

    // Simple batch translation mode (for widget/UI translation)
    const prompt = `Translate the following texts to ${targetLang}. Return a JSON array of translated strings in the same order. Only return the JSON array, nothing else.\n\nTexts:\n${JSON.stringify(textArray)}`;

    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash-lite",
        messages: [
          { role: "system", content: "You are a translation engine. Only return valid JSON arrays of translated strings." },
          { role: "user", content: prompt },
        ],
        tools: [{
          type: "function",
          function: {
            name: "return_translations",
            description: "Return translated texts",
            parameters: {
              type: "object",
              properties: {
                translations: { type: "array", items: { type: "string" } }
              },
              required: ["translations"],
              additionalProperties: false,
            }
          }
        }],
        tool_choice: { type: "function", function: { name: "return_translations" } },
      }),
    });

    if (!response.ok) {
      if (response.status === 429) return new Response(JSON.stringify({ error: "Rate limited" }), { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      if (response.status === 402) return new Response(JSON.stringify({ error: "Credits exhausted" }), { status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      const t = await response.text();
      console.error("AI error:", response.status, t);
      return new Response(JSON.stringify({ error: "Translation failed" }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const data = await response.json();
    const toolCall = data.choices?.[0]?.message?.tool_calls?.[0];
    let translations: string[];
    if (toolCall?.function?.arguments) {
      const parsed = JSON.parse(toolCall.function.arguments);
      translations = parsed.translations;
    } else {
      const content = data.choices?.[0]?.message?.content || "[]";
      translations = JSON.parse(content.replace(/```json\n?|\n?```/g, "").trim());
    }

    return new Response(JSON.stringify({ translations }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("translate error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
