import { useEffect, useRef, useCallback, useState } from "react";

const EMERGENCY_KEYWORDS = [
  "help", "help me", "emergency", "call for help",
  "i need help", "somebody help", "please help",
  "i'm falling", "i fell", "i can't breathe",
  "chest pain", "heart attack", "stroke",
  "sos", "save me", "ambulance",
  "call ambulance", "doctor", "call doctor",
  "i'm hurt", "bleeding", "pain", "fire",
  "can't move", "dizzy", "fainted",
  "bachao", "madad", "help help",
];

interface UseAlwaysOnVoiceOptions {
  enabled: boolean;
  onEmergencyDetected: (transcript: string) => void;
}

export function useAlwaysOnVoice({ enabled, onEmergencyDetected }: UseAlwaysOnVoiceOptions) {
  const [isActive, setIsActive] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const recognitionRef = useRef<any>(null);
  const restartTimeoutRef = useRef<any>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const volumeCheckRef = useRef<any>(null);

  // Listen for signals from other voice features to pause/resume
  useEffect(() => {
    const handleSessionStart = () => {
      console.log("Background voice pausing - foreground session detected");
      setIsPaused(true);
    };
    const handleSessionEnd = () => {
      console.log("Background voice resuming - foreground session ended");
      setIsPaused(false);
    };

    window.addEventListener("voice-session-start", handleSessionStart);
    window.addEventListener("voice-session-end", handleSessionEnd);

    return () => {
      window.removeEventListener("voice-session-start", handleSessionStart);
      window.removeEventListener("voice-session-end", handleSessionEnd);
    };
  }, []);

  const stopVolumeMonitoring = useCallback(() => {
    if (volumeCheckRef.current) {
      cancelAnimationFrame(volumeCheckRef.current);
      volumeCheckRef.current = null;
    }
    if (audioContextRef.current) {
      audioContextRef.current.close().catch(() => {});
      audioContextRef.current = null;
    }
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    }
    analyserRef.current = null;
  }, []);

  const startVolumeMonitoring = useCallback(async () => {
    if (isPaused || !enabled) return;
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;
      const audioContext = new AudioContext();
      audioContextRef.current = audioContext;
      const source = audioContext.createMediaStreamSource(stream);
      const analyser = audioContext.createAnalyser();
      analyser.fftSize = 512;
      analyser.smoothingTimeConstant = 0.3;
      source.connect(analyser);
      analyserRef.current = analyser;

      const dataArray = new Uint8Array(analyser.frequencyBinCount);
      let shoutFrames = 0;

      const checkVolume = () => {
        if (!analyserRef.current || isPaused) return;
        analyserRef.current.getByteFrequencyData(dataArray);
        const avg = dataArray.reduce((sum, v) => sum + v, 0) / dataArray.length;

        if (avg > 120) {
          shoutFrames++;
          if (shoutFrames > 8) {
            onEmergencyDetected("Loud shouting detected!");
            shoutFrames = 0;
          }
        } else {
          shoutFrames = Math.max(0, shoutFrames - 1);
        }

        volumeCheckRef.current = requestAnimationFrame(checkVolume);
      };

      volumeCheckRef.current = requestAnimationFrame(checkVolume);
    } catch (e) {
      console.warn("Volume monitoring unavailable:", e);
    }
  }, [onEmergencyDetected, isPaused, enabled]);

  const startListening = useCallback(() => {
    if (isPaused || !enabled) return;
    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SpeechRecognition) return;

    const recognition = new SpeechRecognition();
    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.lang = "en-US";

    recognition.onstart = () => {
      console.log("Always-on voice recognition started");
      setIsActive(true);
    };

    recognition.onresult = (event: any) => {
      for (let i = event.resultIndex; i < event.results.length; i++) {
        const transcript = event.results[i][0].transcript.toLowerCase().trim();
        const isEmergency = EMERGENCY_KEYWORDS.some((kw) => transcript.includes(kw));
        if (isEmergency && event.results[i].isFinal) {
          onEmergencyDetected(transcript);
        }
      }
    };

    recognition.onerror = (event: any) => {
      console.error("Always-on voice recognition error:", event.error);
      if (event.error === "not-allowed" || event.error === "service-not-allowed") {
        setIsActive(false);
        return;
      }
      if (!isPaused && enabled) {
        restartTimeoutRef.current = setTimeout(startListening, 2000);
      }
    };

    recognition.onend = () => {
      console.log("Always-on voice recognition ended");
      setIsActive(false);
      if (enabled && !isPaused) {
        restartTimeoutRef.current = setTimeout(startListening, 1000);
      }
    };

    recognitionRef.current = recognition;
    try {
      recognition.start();
    } catch (e) {
      console.log("Always-on start failed (likely already running):", e);
    }
  }, [enabled, onEmergencyDetected, isPaused]);

  useEffect(() => {
    if (enabled && !isPaused) {
      startListening();
      startVolumeMonitoring();
    } else {
      if (recognitionRef.current) {
        recognitionRef.current.onend = null;
        recognitionRef.current.stop();
        recognitionRef.current = null;
      }
      clearTimeout(restartTimeoutRef.current);
      stopVolumeMonitoring();
      setIsActive(false);
    }
    
    return () => {
      if (recognitionRef.current) {
        recognitionRef.current.onend = null;
        recognitionRef.current.stop();
        recognitionRef.current = null;
      }
      clearTimeout(restartTimeoutRef.current);
      stopVolumeMonitoring();
    };
  }, [enabled, isPaused, startListening, startVolumeMonitoring, stopVolumeMonitoring]);

  return { isActive, isPaused };
}
