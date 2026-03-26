import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

// Specialist mapping with keywords and categories
const SPECIALIST_MAPPING = [
  {
    id: "cardiologist",
    name: "Dr. Michael",
    title: "Heart Health Guide",
    keywords: ["heart", "chest pain", "blood pressure", "bp", "palpitation", "heartbeat", "cardiac", "cholesterol", "circulation", "pulse"],
    category: "heart"
  },
  {
    id: "pulmonologist",
    name: "Dr. Daniel",
    title: "Breathing & Lung Care",
    keywords: ["breathing", "breath", "lungs", "cough", "asthma", "shortness of breath", "wheezing", "respiratory", "oxygen", "inhaler"],
    category: "heart"
  },
  {
    id: "diabetologist",
    name: "Dr. Steven",
    title: "Diabetes Care Friend",
    keywords: ["diabetes", "sugar", "blood sugar", "glucose", "insulin", "diabetic", "sugar level", "sweet", "hba1c"],
    category: "heart"
  },
  {
    id: "psychiatrist",
    name: "Dr. Emma",
    title: "Mental Wellness Friend",
    keywords: ["sad", "anxiety", "anxious", "depressed", "depression", "stress", "worried", "mental", "mood", "emotional", "panic", "fear", "lonely", "upset", "crying", "nervous"],
    category: "brain"
  },
  {
    id: "sleep-specialist",
    name: "Dr. David",
    title: "Sleep & Rest Guide",
    keywords: ["sleep", "insomnia", "cant sleep", "tired", "fatigue", "rest", "nightmare", "snoring", "drowsy", "exhausted", "sleepy"],
    category: "brain"
  },
  {
    id: "orthopedist",
    name: "Dr. William",
    title: "Bones & Joints Helper",
    keywords: ["joint", "bone", "arthritis", "knee", "back pain", "hip", "shoulder", "spine", "fracture", "stiff", "swelling", "osteoporosis"],
    category: "bones"
  },
  {
    id: "physiotherapist",
    name: "Dr. Thomas",
    title: "Movement Coach",
    keywords: ["exercise", "movement", "mobility", "stretching", "walking", "balance", "physical therapy", "muscle", "weak", "strength"],
    category: "bones"
  },
  {
    id: "pharmacist",
    name: "Dr. Carol",
    title: "Medicine Helper",
    keywords: ["medicine", "medication", "pill", "tablet", "drug", "prescription", "dose", "side effect", "pharmacy", "capsule"],
    category: "wellness"
  },
  {
    id: "dermatologist",
    name: "Dr. Frank",
    title: "Skin Care Friend",
    keywords: ["skin", "rash", "itch", "itchy", "dry skin", "eczema", "allergy", "bump", "wound", "sore", "nail"],
    category: "wellness"
  },
  {
    id: "nutritionist",
    name: "Dr. Maria",
    title: "Nutrition Guide",
    keywords: ["diet", "food", "eating", "nutrition", "weight", "vitamin", "meal", "appetite", "hungry", "digestion", "stomach ache"],
    category: "primary"
  },
  {
    id: "geriatrician",
    name: "Dr. James",
    title: "Senior Care Specialist",
    keywords: ["aging", "age", "memory", "forgetful", "elderly", "senior", "old age", "confusion"],
    category: "primary"
  },
  {
    id: "general-physician",
    name: "Dr. Sarah",
    title: "General Physician",
    keywords: ["general", "fever", "cold", "flu", "headache", "pain", "sick", "unwell", "health", "checkup", "doctor"],
    category: "primary"
  },
];

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { transcript } = await req.json();

    if (!transcript || transcript.trim().length === 0) {
      return new Response(
        JSON.stringify({ error: "No speech provided" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const OPENAI_API_KEY = Deno.env.get("OPENAI_API_KEY");
    if (!OPENAI_API_KEY) {
      throw new Error("OPENAI_API_KEY is not configured");
    }

    // Use AI to analyze the transcript and determine the best specialist
    const analysisPrompt = `You are a medical triage assistant. Analyze the following patient description and determine which specialist would be most appropriate.

Patient's description: "${transcript}"

Available specialists:
${SPECIALIST_MAPPING.map(s => `- ${s.id}: ${s.title} (handles: ${s.keywords.slice(0, 5).join(", ")}...)`).join("\n")}

Respond with ONLY a JSON object in this exact format:
{
  "specialist_id": "the-specialist-id",
  "confidence": 0.0 to 1.0,
  "reason": "Brief explanation of why this specialist was chosen",
  "extracted_symptoms": ["list", "of", "key", "symptoms"],
  "urgency": "low" | "medium" | "high"
}

If the description is unclear or too vague, default to "general-physician".
If the description mentions emergency symptoms (severe chest pain, difficulty breathing, stroke symptoms), set urgency to "high".`;

    const response = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${OPENAI_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "gpt-4o-mini",
        messages: [
          { role: "user", content: analysisPrompt },
        ],
        temperature: 0.3,
        max_tokens: 300,
      }),
    });

    if (!response.ok) {
      // Fallback to keyword matching if AI fails
      console.error("AI triage failed, using keyword fallback");
      const lowerTranscript = transcript.toLowerCase();

      let bestMatch = SPECIALIST_MAPPING.find(s => s.id === "general-physician");
      let bestScore = 0;

      for (const specialist of SPECIALIST_MAPPING) {
        const score = specialist.keywords.filter(kw => lowerTranscript.includes(kw)).length;
        if (score > bestScore) {
          bestScore = score;
          bestMatch = specialist;
        }
      }

      return new Response(
        JSON.stringify({
          specialist: bestMatch,
          confidence: bestScore > 0 ? 0.6 : 0.3,
          reason: bestScore > 0 ? `Matched keywords related to ${bestMatch!.title}` : "Defaulting to general physician",
          extracted_symptoms: [],
          urgency: "low",
          method: "keyword_fallback"
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const data = await response.json();
    const content = data.choices?.[0]?.message?.content || "";

    // Parse AI response
    let analysisResult;
    try {
      // Extract JSON from response (handle markdown code blocks)
      const jsonMatch = content.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        analysisResult = JSON.parse(jsonMatch[0]);
      } else {
        throw new Error("No JSON found in response");
      }
    } catch (e) {
      console.error("Failed to parse AI response:", content);
      // Fallback
      analysisResult = {
        specialist_id: "general-physician",
        confidence: 0.5,
        reason: "Could not determine specific issue, defaulting to general care",
        extracted_symptoms: [],
        urgency: "low"
      };
    }

    // Find the full specialist info
    const specialist = SPECIALIST_MAPPING.find(s => s.id === analysisResult.specialist_id)
      || SPECIALIST_MAPPING.find(s => s.id === "general-physician");

    return new Response(
      JSON.stringify({
        specialist,
        confidence: analysisResult.confidence,
        reason: analysisResult.reason,
        extracted_symptoms: analysisResult.extracted_symptoms,
        urgency: analysisResult.urgency,
        transcript: transcript,
        method: "ai_analysis"
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error) {
    console.error("Voice triage error:", error);
    return new Response(
      JSON.stringify({
        error: "I couldn't understand that. Please try again or select a specialist manually.",
        specialist: {
          id: "general-physician",
          name: "Dr. Sarah",
          title: "General Physician"
        }
      }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
