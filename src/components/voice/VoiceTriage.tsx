import { useState, useCallback, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { Mic, MicOff, Loader2, Volume2, X, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { useSpeechRecognition } from "@/hooks/useSpeechRecognition";
import { useTextToSpeech } from "@/hooks/useTextToSpeech";
import { toast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import { motion, AnimatePresence } from "framer-motion";

interface TriageResult {
  specialist: {
    id: string;
    name: string;
    title: string;
  };
  confidence: number;
  reason: string;
  extracted_symptoms: string[];
  urgency: "low" | "medium" | "high";
  transcript: string;
}

interface VoiceTriageProps {
  onClose?: () => void;
  isFullscreen?: boolean;
}

export function VoiceTriage({ onClose, isFullscreen = false }: VoiceTriageProps) {
  const navigate = useNavigate();
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [triageResult, setTriageResult] = useState<TriageResult | null>(null);
  const [currentTranscript, setCurrentTranscript] = useState("");
  const isProcessingRef = useRef(false);
  const isMountedRef = useRef(true);
  const navTargetRef = useRef<{ id: string; transcript: string } | null>(null);

  useEffect(() => {
    return () => { isMountedRef.current = false; };
  }, []);

  const handleVoiceEnd = useCallback(() => {
    if (navTargetRef.current && isMountedRef.current) {
      navigate(`/consultation/${navTargetRef.current.id}`, {
        state: { 
          initialMessage: navTargetRef.current.transcript,
          fromTriage: true 
        }
      });
    }
  }, [navigate]);

  const { speak, isSpeaking } = useTextToSpeech({ 
    voiceGender: "female",
    onEnd: handleVoiceEnd
  });

  const handleTriageComplete = useCallback(async (transcript: string) => {
    // If it's the pending transcription state, do nothing
    if (transcript === "Transcribing using NLP...") return;

    if (!transcript.trim() || isProcessingRef.current) return;
    
    isProcessingRef.current = true;
    setIsAnalyzing(true);
    setCurrentTranscript(transcript);

    try {
      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/voice-triage`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
          },
          body: JSON.stringify({ transcript }),
        }
      );

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(`Failed to analyze: ${response.status} ${errorData.error || ""}`);
      }

      const result = await response.json();
      setTriageResult(result);

      // Setup navigation target to fire when speech ends
      const target = { id: result.specialist.id, transcript };
      navTargetRef.current = target; // Ensure closure sees updated value

      // Announce the result
      const announcement = `I understand. Based on what you told me, I'm connecting you with ${result.specialist.name}, our ${result.specialist.title}. They're perfect for helping with ${result.reason.toLowerCase()}.`;
      speak(announcement);
      
      setIsAnalyzing(false);
      isProcessingRef.current = false;

    } catch (error: any) {
      console.error("Triage error:", error);
      toast({
        title: "Connection Error",
        description: error.message.includes("404")
          ? "The triage service is not deployed yet. Please run the deployment steps."
          : `Couldn't connect: ${error.message}`,
        variant: "destructive",
      });
      setIsAnalyzing(false);
      isProcessingRef.current = false;
    }
  }, [speak]);

  const { 
    isListening, 
    transcript, 
    startListening, 
    stopListening,
    isSupported 
  } = useSpeechRecognition({
    continuous: true,
    onResult: handleTriageComplete,
  });

  // Calculate busy state for UI
  const isTranscribing = currentTranscript === "Transcribing using NLP...";
  const isBusy = isAnalyzing || isTranscribing;

  // Update live transcript
  useEffect(() => {
    if (transcript) {
      setCurrentTranscript(transcript);
    }
  }, [transcript]);

  const handleVoiceToggle = () => {
    if (isListening) {
      stopListening();
    } else {
      setTriageResult(null);
      setCurrentTranscript("");
      startListening();
    }
  };

  const containerClass = isFullscreen 
    ? "fixed inset-0 z-50 bg-background flex items-center justify-center p-4"
    : "";

  return (
    <div className={containerClass}>
      <Card className={cn(
        "border-2 overflow-hidden",
        isFullscreen ? "max-w-lg w-full" : "w-full"
      )}>
        <CardContent className="p-6">
          {/* Header */}
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center gap-2">
              <Sparkles className="h-5 w-5 text-primary" />
              <h2 className="text-xl font-semibold">Just Tell Me What's Wrong</h2>
            </div>
            {onClose && (
              <Button variant="ghost" size="icon" onClick={onClose}>
                <X className="h-5 w-5" />
              </Button>
            )}
          </div>

          {/* Main Voice Button */}
          <div className="flex flex-col items-center py-8">
            <motion.div
              animate={isListening ? { scale: [1, 1.1, 1] } : {}}
              transition={{ repeat: Infinity, duration: 1 }}
              className="relative"
            >
              {/* Pulsing ring when listening */}
              {isListening && (
                <motion.div
                  className="absolute inset-0 rounded-full bg-primary/20"
                  animate={{ scale: [1, 1.5, 1], opacity: [0.5, 0, 0.5] }}
                  transition={{ repeat: Infinity, duration: 1.5 }}
                />
              )}
              
              <Button
                size="lg"
                onClick={handleVoiceToggle}
                disabled={!isSupported || isBusy}
                className={cn(
                  "h-28 w-28 rounded-full shadow-lg transition-all duration-300 relative z-10",
                  isListening 
                    ? "bg-destructive hover:bg-destructive/90" 
                    : "bg-primary hover:bg-primary/90"
                )}
              >
                {isBusy ? (
                  <Loader2 className="h-10 w-10 animate-spin" />
                ) : isListening ? (
                  <MicOff className="h-10 w-10" />
                ) : (
                  <Mic className="h-10 w-10" />
                )}
              </Button>
            </motion.div>

            {/* Status Text */}
            <p className="text-lg text-muted-foreground mt-4 text-center">
              {isBusy ? (
                <span className="flex items-center gap-2">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  {isAnalyzing ? "Analyzing your symptoms..." : "Transcribing your voice..."}
                </span>
              ) : isListening ? (
                "I'm listening... describe how you feel"
              ) : (
                "Tap and tell me what's bothering you"
              )}
            </p>

            {/* Live Transcript */}
            <AnimatePresence>
              {currentTranscript && (
                <motion.div
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -10 }}
                  className="mt-4 p-4 bg-muted rounded-xl max-w-md"
                >
                  <p className="text-sm text-muted-foreground mb-1">You said:</p>
                  <p className="text-base">"{currentTranscript}"</p>
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          {/* Triage Result */}
          <AnimatePresence>
            {triageResult && (
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                className="mt-4 p-4 bg-primary/5 rounded-xl border border-primary/20"
              >
                <div className="flex items-center gap-3 mb-2">
                  {isSpeaking && <Volume2 className="h-4 w-4 text-primary animate-pulse" />}
                  <p className="font-medium text-primary">
                    Connecting you to the right specialist...
                  </p>
                </div>
                <div className="flex items-center gap-3 mt-3">
                  <div className="h-12 w-12 rounded-full bg-primary/10 flex items-center justify-center text-2xl">
                    🩺
                  </div>
                  <div>
                    <p className="font-semibold">{triageResult.specialist.name}</p>
                    <p className="text-sm text-muted-foreground">{triageResult.specialist.title}</p>
                  </div>
                </div>
                <p className="text-sm text-muted-foreground mt-2">
                  {triageResult.reason}
                </p>
                
                {triageResult.urgency === "high" && (
                  <div className="mt-3 p-2 bg-destructive/10 rounded-lg border border-destructive/20">
                    <p className="text-sm text-destructive font-medium">
                      ⚠️ This sounds urgent. If this is an emergency, please call 911 or your local emergency number.
                    </p>
                  </div>
                )}
              </motion.div>
            )}
          </AnimatePresence>

          {/* Helper Text */}
          <div className="mt-6 text-center">
            <p className="text-xs text-muted-foreground">
              Example: "I've been having chest pain and feeling short of breath" or "My knee hurts when I walk"
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
