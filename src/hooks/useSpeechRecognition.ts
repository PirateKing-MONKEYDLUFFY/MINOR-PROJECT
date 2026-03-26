
import { useState, useCallback, useRef, useEffect } from "react";
import { toast } from "@/hooks/use-toast";

interface UseSpeechRecognitionOptions {
  continuous?: boolean;
  language?: string;
  autoStopTimeout?: number; // Time in ms to wait for silence before auto-stopping
  onResult?: (transcript: string) => void;
  onError?: (error: string) => void;
}

export function useSpeechRecognition(options: UseSpeechRecognitionOptions = {}) {
  const {
    continuous = false,
    language = "en-IN",
    autoStopTimeout = 10000,
    onResult,
    onError
  } = options;

  const [isListening, setIsListening] = useState(false);
  const [transcript, setTranscript] = useState("");
  const [isSupported, setIsSupported] = useState(true);

  const recognitionRef = useRef<any>(null);
  const manualStopRef = useRef<boolean>(false);
  const silenceTimerRef = useRef<any>(null);
  const accumulatedTranscriptRef = useRef<string>("");
  const transcriptRef = useRef<string>("");

  useEffect(() => {
    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SpeechRecognition) {
      setIsSupported(false);
    }
    return () => {
      manualStopRef.current = true;
      if (silenceTimerRef.current) clearTimeout(silenceTimerRef.current);
      if (recognitionRef.current) {
        recognitionRef.current.onend = null;
        recognitionRef.current.onerror = null;
        try { recognitionRef.current.abort(); } catch (e) { }
      }
    };
  }, []);

  const stopListening = useCallback(() => {
    manualStopRef.current = true;
    if (silenceTimerRef.current) clearTimeout(silenceTimerRef.current);

    window.dispatchEvent(new CustomEvent("voice-session-end"));

    if (recognitionRef.current) {
      recognitionRef.current.onend = null;
      try {
        recognitionRef.current.stop();
      } catch (e) {
        try { recognitionRef.current.abort(); } catch (err) { }
      }
      recognitionRef.current = null;
    }

    setIsListening(false);

    const finalResult = transcriptRef.current.trim();
    if (finalResult && onResult) {
      onResult(finalResult);
    }

    return finalResult;
  }, [onResult]);

  const resetSilenceTimer = useCallback(() => {
    if (silenceTimerRef.current) clearTimeout(silenceTimerRef.current);

    if (isListening && !manualStopRef.current) {
      silenceTimerRef.current = setTimeout(() => {
        stopListening();
      }, autoStopTimeout);
    }
  }, [isListening, autoStopTimeout, stopListening]);

  const initRecognition = useCallback(() => {
    if (manualStopRef.current) return;

    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    const recognition = new SpeechRecognition();

    recognition.continuous = continuous;
    recognition.interimResults = true;
    recognition.lang = language;

    // Track final results per instance to avoid double counting
    let sessionFinalResults = "";

    recognition.onstart = () => {
      console.log("Voice instance started");
    };

    recognition.onresult = (event: any) => {
      let currentInstanceFinal = "";
      let interim = "";

      for (let i = event.resultIndex; i < event.results.length; i++) {
        const result = event.results[i];
        if (result.isFinal) {
          currentInstanceFinal += result[0].transcript + " ";
        } else {
          interim += result[0].transcript;
        }
      }

      if (currentInstanceFinal) {
        sessionFinalResults += currentInstanceFinal;
        resetSilenceTimer();
      } else if (interim) {
        resetSilenceTimer();
      }

      const fullTranscript = (accumulatedTranscriptRef.current + sessionFinalResults + interim).trim();
      setTranscript(fullTranscript);
      transcriptRef.current = fullTranscript;
    };

    recognition.onerror = (event: any) => {
      if (event.error === 'not-allowed' || event.error === 'service-not-allowed') {
        toast({
          title: "Microphone Access Denied",
          description: "Please check your browser permissions.",
          variant: "destructive",
        });
        stopListening();
        return;
      }
      // Let onend handle silent restarts for no-speech/aborted
    };

    recognition.onend = () => {
      if (manualStopRef.current) return;

      // Before restarting, move the current session final results into the global accumulator
      accumulatedTranscriptRef.current += sessionFinalResults;

      setTimeout(() => {
        if (!manualStopRef.current) initRecognition();
      }, 100);
    };

    recognitionRef.current = recognition;
    try {
      recognition.start();
    } catch (e) {
      console.log("Start failed:", e);
    }
  }, [continuous, language, resetSilenceTimer, stopListening]);

  const startListening = useCallback(() => {
    if (!isSupported) {
      toast({
        title: "Voice not supported",
        description: "Your browser doesn't support voice input.",
        variant: "destructive",
      });
      return;
    }

    manualStopRef.current = false;
    accumulatedTranscriptRef.current = "";
    transcriptRef.current = "";
    setTranscript("");
    setIsListening(true);

    window.dispatchEvent(new CustomEvent("voice-session-start"));

    initRecognition();
    resetSilenceTimer();

  }, [isSupported, initRecognition, resetSilenceTimer]);

  const toggleListening = useCallback(() => {
    if (isListening) {
      return stopListening();
    } else {
      startListening();
      return "";
    }
  }, [isListening, startListening, stopListening]);

  return {
    isListening,
    transcript,
    isSupported,
    startListening,
    stopListening,
    toggleListening,
  };
}
