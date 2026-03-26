import { useState, useCallback, useRef, useEffect } from "react";
import { toast } from "@/hooks/use-toast";

interface UseTextToSpeechOptions {
  voiceGender?: "male" | "female";
  onStart?: () => void;
  onEnd?: () => void;
}

export function useTextToSpeech(options: UseTextToSpeechOptions = {}) {
  const { voiceGender = "female", onStart, onEnd } = options;
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const requestCountRef = useRef<number>(0);

  // Auto-stop on unmount
  useEffect(() => {
    return () => {
      if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current = null;
      }
      requestCountRef.current++;
    };
  }, []);

  const stop = useCallback(() => {
    // Invalidate any pending requests
    requestCountRef.current++;
    
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current.currentTime = 0;
      audioRef.current = null;
    }
    setIsSpeaking(false);
    onEnd?.();
  }, [onEnd]);

  const speak = useCallback(async (text: string) => {
    if (!text || text.trim().length === 0) return;

    stop();
    const currentRequestId = ++requestCountRef.current;
    setIsLoading(true);

    try {
      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/text-to-speech`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
            Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
          },
          body: JSON.stringify({ text, voiceGender }),
        }
      );

      if (currentRequestId !== requestCountRef.current) {
        console.log("TTS request superseded by newer one. Skipping playback.");
        return;
      }

      if (!response.ok) {
        throw new Error(`TTS request failed: ${response.status}`);
      }

      const data = await response.json();
      
      if (currentRequestId !== requestCountRef.current) return;

      if (data.error) {
        throw new Error(data.error);
      }

      // Use data URI for audio playback
      const audioUrl = `data:audio/mpeg;base64,${data.audioContent}`;
      const audio = new Audio(audioUrl);
      audioRef.current = audio;

      audio.onplay = () => {
        setIsSpeaking(true);
        onStart?.();
      };

      audio.onended = () => {
        setIsSpeaking(false);
        audioRef.current = null;
        onEnd?.();
      };

      audio.onerror = () => {
        setIsSpeaking(false);
        audioRef.current = null;
        onEnd?.();
        console.error("Audio playback error");
      };

      await audio.play();
    } catch (error) {
      console.error("TTS error:", error);
      // Fallback to browser speech synthesis
      if ('speechSynthesis' in window) {
        const utterance = new SpeechSynthesisUtterance(text);
        utterance.rate = 0.85;
        utterance.pitch = 1;
        utterance.onstart = () => {
          setIsSpeaking(true);
          onStart?.();
        };
        utterance.onend = () => {
          setIsSpeaking(false);
          onEnd?.();
        };
        window.speechSynthesis.speak(utterance);
      } else {
        toast({
          title: "Voice unavailable",
          description: "Unable to play audio response",
          variant: "destructive",
        });
      }
    } finally {
      setIsLoading(false);
    }
  }, [voiceGender, stop, onStart, onEnd]);

  return {
    speak,
    stop,
    isSpeaking,
    isLoading,
  };
}
