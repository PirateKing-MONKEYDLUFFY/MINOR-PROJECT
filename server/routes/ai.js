import { Router } from "express";

const router = Router();

// ── Medical Chat ──────────────────────────────────
router.post("/medical-chat", async (req, res) => {
    try {
        const { messages, specialistId, systemPrompt } = req.body;

        const OPENAI_API_KEY = process.env.OPENAI_API_KEY;
        if (!OPENAI_API_KEY) {
            throw new Error("OPENAI_API_KEY is not configured");
        }

        const medicalSystemPrompt = `${systemPrompt}

CRITICAL RESPONSE RULES - YOU MUST FOLLOW THESE:

1. LENGTH: Keep responses SHORT! Maximum 2-3 sentences for simple questions. Never more than 5 sentences.

2. TONE: Be warm like a caring friend. Use phrases like:
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

        const response = await fetch("https://api.openai.com/v1/chat/completions", {
            method: "POST",
            headers: {
                Authorization: `Bearer ${OPENAI_API_KEY}`,
                "Content-Type": "application/json",
            },
            body: JSON.stringify({
                model: "gpt-4o-mini",
                messages: [
                    { role: "system", content: medicalSystemPrompt },
                    ...messages,
                ],
                temperature: 0.7,
                max_tokens: 300,
            }),
        });

        if (!response.ok) {
            if (response.status === 429) {
                return res.status(429).json({ error: "I'm a bit busy right now. Could you try again in a moment?" });
            }
            const errorText = await response.text();
            console.error("AI error:", response.status, errorText);
            throw new Error(`AI error: ${response.status}`);
        }

        const data = await response.json();
        const content = data.choices?.[0]?.message?.content || "I'm sorry, I didn't quite catch that. Could you tell me more?";

        res.json({ content });
    } catch (error) {
        console.error("Medical chat error:", error);
        res.status(500).json({ error: "I'm having a little trouble right now. Please try again." });
    }
});

// ── Voice Triage ──────────────────────────────────
const SPECIALIST_MAPPING = [
    { id: "cardiologist", name: "Dr. Michael", title: "Heart Health Guide", keywords: ["heart", "chest pain", "blood pressure", "bp", "palpitation", "heartbeat", "cardiac", "cholesterol", "circulation", "pulse"], category: "heart" },
    { id: "pulmonologist", name: "Dr. Daniel", title: "Breathing & Lung Care", keywords: ["breathing", "breath", "lungs", "cough", "asthma", "shortness of breath", "wheezing", "respiratory", "oxygen", "inhaler"], category: "heart" },
    { id: "diabetologist", name: "Dr. Steven", title: "Diabetes Care Friend", keywords: ["diabetes", "sugar", "blood sugar", "glucose", "insulin", "diabetic", "sugar level", "sweet", "hba1c"], category: "heart" },
    { id: "psychiatrist", name: "Dr. Emma", title: "Mental Wellness Friend", keywords: ["sad", "anxiety", "anxious", "depressed", "depression", "stress", "worried", "mental", "mood", "emotional", "panic", "fear", "lonely", "upset", "crying", "nervous"], category: "brain" },
    { id: "sleep-specialist", name: "Dr. David", title: "Sleep & Rest Guide", keywords: ["sleep", "insomnia", "cant sleep", "tired", "fatigue", "rest", "nightmare", "snoring", "drowsy", "exhausted", "sleepy"], category: "brain" },
    { id: "orthopedist", name: "Dr. William", title: "Bones & Joints Helper", keywords: ["joint", "bone", "arthritis", "knee", "back pain", "hip", "shoulder", "spine", "fracture", "stiff", "swelling", "osteoporosis"], category: "bones" },
    { id: "physiotherapist", name: "Dr. Thomas", title: "Movement Coach", keywords: ["exercise", "movement", "mobility", "stretching", "walking", "balance", "physical therapy", "muscle", "weak", "strength"], category: "bones" },
    { id: "pharmacist", name: "Dr. Carol", title: "Medicine Helper", keywords: ["medicine", "medication", "pill", "tablet", "drug", "prescription", "dose", "side effect", "pharmacy", "capsule"], category: "wellness" },
    { id: "dermatologist", name: "Dr. Frank", title: "Skin Care Friend", keywords: ["skin", "rash", "itch", "itchy", "dry skin", "eczema", "allergy", "bump", "wound", "sore", "nail"], category: "wellness" },
    { id: "nutritionist", name: "Dr. Maria", title: "Nutrition Guide", keywords: ["diet", "food", "eating", "nutrition", "weight", "vitamin", "meal", "appetite", "hungry", "digestion", "stomach ache"], category: "primary" },
    { id: "geriatrician", name: "Dr. James", title: "Senior Care Specialist", keywords: ["aging", "age", "memory", "forgetful", "elderly", "senior", "old age", "confusion"], category: "primary" },
    { id: "general-physician", name: "Dr. Sarah", title: "General Physician", keywords: ["general", "fever", "cold", "flu", "headache", "pain", "sick", "unwell", "health", "checkup", "doctor"], category: "primary" },
];

router.post("/voice-triage", async (req, res) => {
    try {
        const { transcript } = req.body;

        if (!transcript?.trim()) {
            return res.status(400).json({ error: "No speech provided" });
        }

        const OPENAI_API_KEY = process.env.OPENAI_API_KEY;
        if (!OPENAI_API_KEY) {
            throw new Error("OPENAI_API_KEY is not configured");
        }

        const analysisPrompt = `You are a medical triage assistant. Analyze the following patient description and determine which specialist would be most appropriate.

Patient's description: "${transcript}"

Available specialists:
${SPECIALIST_MAPPING.map((s) => `- ${s.id}: ${s.title} (handles: ${s.keywords.slice(0, 5).join(", ")}...)`).join("\n")}

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
                messages: [{ role: "user", content: analysisPrompt }],
                temperature: 0.3,
                max_tokens: 300,
            }),
        });

        if (!response.ok) {
            // Fallback to keyword matching
            console.error("AI triage failed, using keyword fallback");
            const lowerTranscript = transcript.toLowerCase();
            let bestMatch = SPECIALIST_MAPPING.find((s) => s.id === "general-physician");
            let bestScore = 0;

            for (const specialist of SPECIALIST_MAPPING) {
                const score = specialist.keywords.filter((kw) => lowerTranscript.includes(kw)).length;
                if (score > bestScore) { bestScore = score; bestMatch = specialist; }
            }

            return res.json({
                specialist: bestMatch,
                confidence: bestScore > 0 ? 0.6 : 0.3,
                reason: bestScore > 0 ? `Matched keywords related to ${bestMatch.title}` : "Defaulting to general physician",
                extracted_symptoms: [],
                urgency: "low",
                method: "keyword_fallback",
            });
        }

        const data = await response.json();
        const content = data.choices?.[0]?.message?.content || "";

        let analysisResult;
        try {
            const jsonMatch = content.match(/\{[\s\S]*\}/);
            if (jsonMatch) {
                analysisResult = JSON.parse(jsonMatch[0]);
            } else {
                throw new Error("No JSON found");
            }
        } catch {
            analysisResult = {
                specialist_id: "general-physician",
                confidence: 0.5,
                reason: "Could not determine specific issue, defaulting to general care",
                extracted_symptoms: [],
                urgency: "low",
            };
        }

        const specialist = SPECIALIST_MAPPING.find((s) => s.id === analysisResult.specialist_id) || SPECIALIST_MAPPING.find((s) => s.id === "general-physician");

        res.json({
            specialist,
            confidence: analysisResult.confidence,
            reason: analysisResult.reason,
            extracted_symptoms: analysisResult.extracted_symptoms,
            urgency: analysisResult.urgency,
            transcript,
            method: "ai_analysis",
        });
    } catch (error) {
        console.error("Voice triage error:", error);
        res.status(500).json({
            error: "I couldn't understand that. Please try again or select a specialist manually.",
            specialist: { id: "general-physician", name: "Dr. Sarah", title: "General Physician" },
        });
    }
});

// ── Text to Speech ────────────────────────────────
const VOICES = {
    female: "EXAVITQu4vr4xnSDxMaL",
    male: "JBFqnCBsd6RMkjVDRZzb",
};

router.post("/text-to-speech", async (req, res) => {
    try {
        const { text, voiceGender = "female" } = req.body;

        const ELEVENLABS_API_KEY = process.env.ELEVENLABS_API_KEY;
        if (!ELEVENLABS_API_KEY) {
            throw new Error("ELEVENLABS_API_KEY is not configured");
        }

        if (!text?.trim()) {
            throw new Error("Text is required");
        }

        const voiceId = voiceGender === "male" ? VOICES.male : VOICES.female;

        const response = await fetch(
            `https://api.elevenlabs.io/v1/text-to-speech/${voiceId}?output_format=mp3_44100_128`,
            {
                method: "POST",
                headers: {
                    "xi-api-key": ELEVENLABS_API_KEY,
                    "Content-Type": "application/json",
                },
                body: JSON.stringify({
                    text,
                    model_id: "eleven_multilingual_v2",
                    voice_settings: {
                        stability: 0.6,
                        similarity_boost: 0.75,
                        style: 0.3,
                        use_speaker_boost: true,
                        speed: 0.85,
                    },
                }),
            }
        );

        if (!response.ok) {
            const errorText = await response.text();
            console.error("ElevenLabs error:", response.status, errorText);
            throw new Error(`TTS error: ${response.status}`);
        }

        const audioBuffer = await response.arrayBuffer();
        const base64Audio = Buffer.from(audioBuffer).toString("base64");

        res.json({ audioContent: base64Audio });
    } catch (error) {
        console.error("TTS error:", error);
        res.status(500).json({ error: error instanceof Error ? error.message : "TTS failed" });
    }
});

export default router;
