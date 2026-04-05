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
      window.speechSynthesis?.cancel();
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
    // Also stop browser speech synthesis if running
    window.speechSynthesis?.cancel();
    setIsSpeaking(false);
    onEnd?.();
  }, [onEnd]);

  const speakWithBrowserTTS = useCallback((text: string) => {
    if (!('speechSynthesis' in window)) {
      toast({
        title: "Voice unavailable",
        description: "Unable to play audio response",
        variant: "destructive",
      });
      return;
    }

    // Cancel any ongoing speech first
    window.speechSynthesis.cancel();

    const utterance = new SpeechSynthesisUtterance(text);
    utterance.rate = 1.0; // Standard speed
    utterance.pitch = 1;
    utterance.volume = 1;
    utterance.lang = "en-IN";

    // Try to find a good English voice
    const selectVoice = () => {
      const voices = window.speechSynthesis.getVoices();
      if (voices.length > 0) {
        // Prefer English (India or US) voices matching the requested gender
        const genderHints = voiceGender === "female" 
          ? ["female", "woman", "zira", "samantha", "google uk english female", "google us english"]
          : ["male", "man", "david", "google uk english male"];
        
        // Priority: en-IN > en-US > en-GB > any en
        const enVoices = voices.filter(v => v.lang.startsWith("en"));
        const preferredVoice = enVoices.find(v => 
          genderHints.some(hint => v.name.toLowerCase().includes(hint))
        ) || enVoices.find(v => v.lang === "en-IN")
          || enVoices.find(v => v.lang === "en-US")
          || enVoices[0];
        
        if (preferredVoice) {
          utterance.voice = preferredVoice;
        }
      }
    };

    // Chrome loads voices asynchronously
    const voices = window.speechSynthesis.getVoices();
    if (voices.length === 0) {
      window.speechSynthesis.onvoiceschanged = () => {
        window.speechSynthesis.onvoiceschanged = null; // Only run once
        selectVoice();
        window.speechSynthesis.speak(utterance);
      };
    } else {
      selectVoice();
      window.speechSynthesis.speak(utterance);
    }

    utterance.onstart = () => {
      setIsSpeaking(true);
      onStart?.();
    };
    utterance.onend = () => {
      setIsSpeaking(false);
      onEnd?.();
    };
    utterance.onerror = (event) => {
      console.error("Browser TTS error:", event.error);
      setIsSpeaking(false);
      onEnd?.();
    };

    // If we already had voices, speak was called synchronously above
    // Otherwise onvoiceschanged will handle it
    if (voices.length > 0) {
      // Chrome has a bug where long utterances get cut off; 
      // workaround: keep speechSynthesis alive with periodic resume
      const keepAlive = setInterval(() => {
        if (window.speechSynthesis.speaking) {
          window.speechSynthesis.pause();
          window.speechSynthesis.resume();
        } else {
          clearInterval(keepAlive);
        }
      }, 10000);

      utterance.onend = () => {
        clearInterval(keepAlive);
        setIsSpeaking(false);
        onEnd?.();
      };
      utterance.onerror = (event) => {
        clearInterval(keepAlive);
        console.error("Browser TTS error:", event.error);
        setIsSpeaking(false);
        onEnd?.();
      };
    }
  }, [voiceGender, onStart, onEnd]);

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
        console.error("Audio playback error, falling back to browser TTS");
        // Fallback to browser TTS on audio playback failure
        speakWithBrowserTTS(text);
      };

      await audio.play();
    } catch (error) {
      console.error("TTS error:", error);
      // Fallback to browser speech synthesis
      setIsLoading(false);
      speakWithBrowserTTS(text);
      return;
    } finally {
      setIsLoading(false);
    }
  }, [voiceGender, stop, onStart, onEnd, speakWithBrowserTTS]);

  return {
    speak,
    stop,
    isSpeaking,
    isLoading,
  };
}
