import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { messages, specialistId, systemPrompt } = await req.json();

    const OPENAI_API_KEY = Deno.env.get("OPENAI_API_KEY");
    if (!OPENAI_API_KEY) {
      throw new Error("OPENAI_API_KEY is not configured");
    }

    // Build the elder-friendly medical prompt
    const medicalSystemPrompt = `${systemPrompt}

CRITICAL RESPONSE RULES - YOU MUST FOLLOW THESE:

1. LENGTH: Keep responses EXTREMELY SHORT! **MAXIMUM 2 sentences**. Never more than 3.
2. TONE: Be warm like a caring friend. Use simple empathy (1 sentence).
   - "I understand how you feel..."
   - "That's a great question!"
   - "You're doing the right thing by asking..."
   - "Don't worry, this is very common..."

3. SIMPLICITY: Use everyday words only. Instead of "hypertension" say "high blood pressure". Instead of "cardiovascular" say "heart".

4. STRUCTURE: 
   - Start with empathy (1 sentence)
   - Give your main advice (1-2 sentences)  
   - End with encouragement (1 sentence)

5. SAFETY: If symptoms sound serious, gently say "This is something to check with your doctor in person, just to be safe."

6. NEVER: 
   - Use bullet points or lists
   - Give long explanations
   - Use medical jargon
   - Be clinical or cold

Remember: Your response will be read aloud to an elderly person. Keep it conversational and comforting.`;

    const response = await fetch("https://api.groq.com/openai/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${OPENAI_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "llama-3.3-70b-versatile",
        messages: [
          { role: "system", content: medicalSystemPrompt },
          ...messages,
        ],
        temperature: 0.7,
        max_tokens: 300, // Reduced for shorter responses
      }),
    });

    if (!response.ok) {
      if (response.status === 429) {
        return new Response(
          JSON.stringify({ error: "I'm a bit busy right now. Could you try again in a moment?" }),
          { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      if (response.status === 402) {
        return new Response(
          JSON.stringify({ error: "I'm taking a short break. Please try again in a little while." }),
          { status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      const errorText = await response.text();
      console.error("AI gateway error:", response.status, errorText);
      throw new Error(`AI gateway error: ${response.status}`);
    }

    const data = await response.json();
    const content = data.choices?.[0]?.message?.content || "I'm sorry, I didn't quite catch that. Could you tell me more?";

    return new Response(
      JSON.stringify({ content }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("Medical chat error:", error);
    return new Response(
      JSON.stringify({
        error: "I'm having a little trouble right now. Please try again."
      }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
