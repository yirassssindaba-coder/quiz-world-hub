import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Get user from token
    const token = authHeader.replace("Bearer ", "");
    const { data: { user }, error: userError } = await supabase.auth.getUser(token);
    if (userError || !user) {
      return new Response(JSON.stringify({ error: "Invalid token" }), { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // Fetch user's quiz history
    const { data: sessions } = await supabase
      .from("quiz_sessions")
      .select("*, categories(name, slug)")
      .eq("user_id", user.id)
      .eq("status", "completed")
      .order("started_at", { ascending: false })
      .limit(50);

    const { data: categories } = await supabase.from("categories").select("*");

    // Build context
    const categoryPerformance: Record<string, { total: number; correct: number; attempts: number }> = {};
    for (const s of (sessions || [])) {
      const catName = s.categories?.name || "Unknown";
      if (!categoryPerformance[catName]) categoryPerformance[catName] = { total: 0, correct: 0, attempts: 0 };
      categoryPerformance[catName].total += s.total_questions;
      categoryPerformance[catName].correct += s.score || 0;
      categoryPerformance[catName].attempts += 1;
    }

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY not configured");

    const prompt = `Based on this student's quiz performance, give personalized recommendations.

Performance by category:
${Object.entries(categoryPerformance).map(([cat, stats]) => 
  `- ${cat}: ${stats.attempts} attempts, ${Math.round((stats.correct / stats.total) * 100)}% accuracy`
).join("\n")}

Available categories: ${(categories || []).map(c => c.name).join(", ")}

Total quizzes completed: ${sessions?.length || 0}

Provide 3-5 specific recommendations including:
1. Which category to focus on next and why
2. Suggested difficulty level
3. Study tips based on weak areas
4. Encouragement based on strengths`;

    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-3-flash-preview",
        messages: [
          { role: "system", content: "You are a personalized learning advisor. Give concise, actionable study recommendations in Indonesian language. Be encouraging and specific." },
          { role: "user", content: prompt },
        ],
        tools: [{
          type: "function",
          function: {
            name: "return_recommendations",
            description: "Return study recommendations",
            parameters: {
              type: "object",
              properties: {
                recommendations: {
                  type: "array",
                  items: {
                    type: "object",
                    properties: {
                      title: { type: "string" },
                      description: { type: "string" },
                      category_slug: { type: "string" },
                      difficulty: { type: "string", enum: ["easy", "medium", "hard"] },
                      priority: { type: "string", enum: ["high", "medium", "low"] },
                    },
                    required: ["title", "description", "priority"],
                    additionalProperties: false,
                  }
                },
                summary: { type: "string" },
                strongest_category: { type: "string" },
                weakest_category: { type: "string" },
              },
              required: ["recommendations", "summary"],
              additionalProperties: false,
            }
          }
        }],
        tool_choice: { type: "function", function: { name: "return_recommendations" } },
      }),
    });

    if (!response.ok) {
      if (response.status === 429) return new Response(JSON.stringify({ error: "Rate limited" }), { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      if (response.status === 402) return new Response(JSON.stringify({ error: "Credits exhausted" }), { status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      throw new Error(`AI error: ${response.status}`);
    }

    const data = await response.json();
    const toolCall = data.choices?.[0]?.message?.tool_calls?.[0];
    let result: any;
    if (toolCall?.function?.arguments) {
      result = JSON.parse(toolCall.function.arguments);
    } else {
      const content = data.choices?.[0]?.message?.content || "{}";
      result = JSON.parse(content.replace(/```json\n?|\n?```/g, "").trim());
    }

    return new Response(JSON.stringify(result), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("quiz-recommend error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
