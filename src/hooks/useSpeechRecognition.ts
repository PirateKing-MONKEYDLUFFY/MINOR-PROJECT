import { useState, useCallback, useRef, useEffect } from "react";
import { toast } from "@/hooks/use-toast";

interface UseSpeechRecognitionOptions {
  continuous?: boolean;
  language?: string;
  onResult?: (transcript: string) => void;
  onError?: (error: string) => void;
}

export function useSpeechRecognition(options: UseSpeechRecognitionOptions = {}) {
  const { onResult, onError } = options;

  const [isListening, setIsListening] = useState(false);
  const [transcript, setTranscript] = useState("");
  const [isSupported, setIsSupported] = useState(true);
  
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);

  useEffect(() => {
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      setIsSupported(false);
    }
  }, []);

  const stopListening = useCallback(() => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state === "recording") {
      mediaRecorderRef.current.stop();
    }
    setIsListening(false);
    return transcript;
  }, [transcript]);

  const startListening = useCallback(async () => {
    if (!isSupported) {
      toast({
        title: "Voice not supported",
        description: "Your browser doesn't support audio recording. Please type your message.",
        variant: "destructive",
      });
      onError?.("Audio recording not supported");
      return;
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mediaRecorder = new MediaRecorder(stream);
      mediaRecorderRef.current = mediaRecorder;
      audioChunksRef.current = [];
      
      setTranscript("");
      setIsListening(true);

      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          audioChunksRef.current.push(event.data);
        }
      };

      mediaRecorder.onstop = async () => {
        stream.getTracks().forEach((track) => track.stop());
        setIsListening(false);
        setTranscript("Transcribing using NLP...");

        const formatOptions = mediaRecorder.mimeType ? { type: mediaRecorder.mimeType } : undefined;
        const audioBlob = new Blob(audioChunksRef.current, formatOptions);
        
        // Use a generic audio extension so the backend multipart parser treats it cleanly
        const extension = mediaRecorder.mimeType.includes("mp4") ? "m4a" : "webm";
        
        const formData = new FormData();
        formData.append("file", audioBlob, `recording.${extension}`);

        try {
          const response = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/speech-to-text`, {
            method: "POST",
            headers: {
              Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
            },
            body: formData,
          });

          if (!response.ok) {
            throw new Error(`Failed to transcribe: ${response.status}`);
          }

          const data = await response.json();
          if (data.error) throw new Error(data.error);

          setTranscript(data.text);
          onResult?.(data.text);
        } catch (error) {
          console.error("STT Error:", error);
          setTranscript("");
          toast({
            title: "Transcription Failed",
            description: "Couldn't process your voice. Please try again.",
            variant: "destructive",
          });
          onError?.("Transcription failed");
        }
      };

      mediaRecorder.start();
    } catch (error) {
      console.error("Mic error:", error);
      setIsListening(false);
      toast({
        title: "Microphone Error",
        description: "Couldn't access your microphone. Please check permissions.",
        variant: "destructive",
      });
      onError?.("Microphone access denied");
    }
  }, [isSupported, onError, onResult]);

  const toggleListening = useCallback(() => {
    if (isListening) {
      return stopListening();
    } else {
      startListening();
      return "";
    }
  }, [isListening, startListening, stopListening]);

  useEffect(() => {
    return () => {
      if (mediaRecorderRef.current && mediaRecorderRef.current.state === "recording") {
        mediaRecorderRef.current.stop();
        mediaRecorderRef.current.stream.getTracks().forEach(t => t.stop());
      }
    };
  }, []);

  return {
    isListening,
    transcript,
    isSupported,
    startListening,
    stopListening,
    toggleListening,
  };
}
