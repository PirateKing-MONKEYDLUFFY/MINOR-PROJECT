import { useState, useCallback } from "react";
import { useAlwaysOnVoice } from "@/hooks/useAlwaysOnVoice";
import { toast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Mic, MicOff, ShieldAlert } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { cn } from "@/lib/utils";

export function EmergencyListener() {
  const [voiceEnabled, setVoiceEnabled] = useState(true); // Always-on by default
  const [emergencyTriggered, setEmergencyTriggered] = useState(false);
  const [detectedPhrase, setDetectedPhrase] = useState("");

  const handleEmergency = useCallback((transcript: string) => {
    setEmergencyTriggered(true);
    setDetectedPhrase(transcript);
    
    // Show emergency toast
    toast({
      title: "🚨 Emergency Detected!",
      description: `Heard: "${transcript}". Alerting emergency contacts...`,
      variant: "destructive",
    });

    // Auto-dismiss after 10 seconds
    setTimeout(() => setEmergencyTriggered(false), 10000);
  }, []);

  const { isActive, isPaused } = useAlwaysOnVoice({
    enabled: voiceEnabled,
    onEmergencyDetected: handleEmergency,
  });

  return (
    <>
      {/* Always-on voice toggle - fixed bottom left */}
      <div className="fixed bottom-6 left-6 z-40 flex items-center gap-3">
        <Button
          variant={voiceEnabled ? "default" : "outline"}
          size="icon"
          onClick={() => setVoiceEnabled(!voiceEnabled)}
          className={cn(
            "h-12 w-12 rounded-full shadow-lg transition-all",
            isPaused && voiceEnabled ? "opacity-50" : ""
          )}
          title={voiceEnabled ? "Voice monitoring active - click to disable" : "Enable always-on voice monitoring"}
        >
          {voiceEnabled ? (
            <motion.div 
              animate={isActive && !isPaused ? { scale: [1, 1.2, 1] } : {}} 
              transition={{ repeat: Infinity, duration: 3 }}
            >
              <Mic className="h-5 w-5" />
            </motion.div>
          ) : (
            <MicOff className="h-5 w-5" />
          )}
        </Button>
        
        {voiceEnabled && isPaused && (
          <motion.div
            initial={{ opacity: 0, x: -10 }}
            animate={{ opacity: 1, x: 0 }}
            className="bg-background/80 backdrop-blur-sm border border-border px-3 py-1.5 rounded-full shadow-sm"
          >
            <p className="text-xs font-medium text-muted-foreground flex items-center gap-2">
              <span className="h-2 w-2 rounded-full bg-yellow-400 animate-pulse" />
              Mic Paused (Session Active)
            </p>
          </motion.div>
        )}
      </div>

      {/* Emergency overlay */}
      <AnimatePresence>
        {emergencyTriggered && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[100] bg-destructive/90 flex items-center justify-center p-4"
          >
            <motion.div
              initial={{ scale: 0.5 }}
              animate={{ scale: 1 }}
              className="text-center text-destructive-foreground"
            >
              <ShieldAlert className="h-24 w-24 mx-auto mb-4 animate-pulse" />
              <h1 className="text-4xl font-bold mb-2">Emergency Detected</h1>
              <p className="text-xl mb-2">Heard: "{detectedPhrase}"</p>
              <p className="text-lg opacity-80 mb-6">Alerting your emergency contacts...</p>
              <Button
                variant="outline"
                size="lg"
                onClick={() => setEmergencyTriggered(false)}
                className="text-destructive-foreground border-destructive-foreground hover:bg-destructive-foreground/10"
              >
                I'm OK - Dismiss
              </Button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
