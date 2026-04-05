import { useState, useEffect, useRef, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { AlarmOverlay } from "./AlarmOverlay";
import { toast } from "@/hooks/use-toast";
import { format, addMinutes, isAfter } from "date-fns";
import { useTextToSpeech } from "@/hooks/useTextToSpeech";

// Stable Digital Alarm Sound (MP3)
const ALARM_URL = "https://assets.mixkit.co/active_storage/sfx/2869/2869-preview.mp3";

interface Medicine {
  id: string;
  name: string;
  dosage: string;
  times: string[];
  instructions: string | null;
}

export const MedicineReminder = () => {
  const { profile } = useAuth();
  const [activeAlarm, setActiveAlarm] = useState<Medicine | null>(null);
  const [medicines, setMedicines] = useState<Medicine[]>([]);
  const { speak, stop: stopTTS } = useTextToSpeech();
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const checkIntervalRef = useRef<any>(null);
  
  // Track dismissed/taken/snoozed doses for the day
  // Format: { "id-time": "dismissed" | "snoozed-until-timestamp" }
  const [dosesState, setDosesState] = useState<Record<string, string>>(() => {
    const saved = localStorage.getItem("medicine_doses_state");
    if (saved) {
      const parsed = JSON.parse(saved);
      // Clear old dates if stored (we only care about today)
      const today = format(new Date(), "yyyy-MM-dd");
      if (parsed?._date !== today) return { _date: today };
      return parsed;
    }
    return { _date: format(new Date(), "yyyy-MM-dd") };
  });

  useEffect(() => {
    localStorage.setItem("medicine_doses_state", JSON.stringify(dosesState));
  }, [dosesState]);

  // Fetch medicines
  const fetchMedicines = useCallback(async () => {
    if (!profile) return;
    try {
      const { data, error } = await supabase
        .from("medicines")
        .select("id, name, dosage, times, instructions")
        .eq("elder_id", profile.id)
        .eq("is_active", true);

      if (error) throw error;
      setMedicines(data || []);
    } catch (err) {
      console.error("MedicineReminder: Error fetching medicines:", err);
    }
  }, [profile]);

  useEffect(() => {
    fetchMedicines();
  }, [fetchMedicines]);

  const stopAlarm = useCallback(() => {
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current.currentTime = 0;
    }
    stopTTS();
    setActiveAlarm(null);
  }, [stopTTS]);

  const playAlarm = useCallback((med: Medicine) => {
    if (!audioRef.current) {
      audioRef.current = new Audio(ALARM_URL);
      audioRef.current.loop = true;
    }
    
    audioRef.current.play().catch(e => {
      console.warn("Alarm audio failed, falling back to TTS:", e);
      // Fallback: Use TTS to announce the medicine
      speak(`Attention. It is time to take your medication: ${med.name}. ${med.dosage}.`);
      
      toast({
        title: "Medicine Reminder Active",
        description: `Time for ${med.name}. Click to dismiss.`,
      });
    });
  }, [speak]);

  const handleTake = async () => {
    if (!activeAlarm) return;
    const time = format(new Date(), "HH:mm");
    const key = `${activeAlarm.id}-${time}`;
    
    try {
      await supabase.from("medicine_logs").insert({
        medicine_id: activeAlarm.id,
        scheduled_time: new Date().toISOString(),
        status: "taken",
        taken_at: new Date().toISOString(),
      });
      
      setDosesState(prev => ({ ...prev, [key]: "dismissed" }));
      stopAlarm();
      toast({ title: "Medicine Logged", description: "Stay healthy!" });
    } catch (err) {
      console.error("Error logging medicine:", err);
    }
  };

  const handleSnooze = () => {
    if (!activeAlarm) return;
    const time = format(new Date(), "HH:mm");
    const key = `${activeAlarm.id}-${time}`;
    const snoozeUntil = addMinutes(new Date(), 5).toISOString();
    
    setDosesState(prev => ({ ...prev, [key]: `snoozed-${snoozeUntil}` }));
    stopAlarm();
    toast({ title: "Snoozed", description: "Alarm will ring again in 5 minutes." });
  };

  const handleDismiss = () => {
    if (!activeAlarm) return;
    const time = format(new Date(), "HH:mm");
    const key = `${activeAlarm.id}-${time}`;
    setDosesState(prev => ({ ...prev, [key]: "dismissed" }));
    stopAlarm();
  };

  const checkReminders = useCallback(() => {
    if (activeAlarm) return; // Don't trigger another while one is active

    const now = new Date();
    const currentTime = format(now, "HH:mm");

    medicines.forEach(med => {
      med.times.forEach(scheduledTime => {
        const key = `${med.id}-${scheduledTime}`;
        const state = dosesState[key];

        // 1. Check if the time matches (standard minute check)
        if (currentTime === scheduledTime) {
          if (!state || state === "pending") {
            setActiveAlarm(med);
            playAlarm(med);
          }
        }

        // 2. Check for snoozed alarms
        if (state?.startsWith("snoozed-")) {
          const snoozeUntil = new Date(state.split("snoozed-")[1]);
          if (isAfter(now, snoozeUntil)) {
            setActiveAlarm(med);
            playAlarm(med);
          }
        }
      });
    });
  }, [activeAlarm, medicines, dosesState, playAlarm]);

  useEffect(() => {
    // Check every 30 seconds to be precise
    checkIntervalRef.current = setInterval(checkReminders, 30000);
    return () => clearInterval(checkIntervalRef.current);
  }, [checkReminders]);

  if (!activeAlarm) return null;

  return (
    <AlarmOverlay
      medicineName={activeAlarm.name}
      dosage={activeAlarm.dosage}
      instructions={activeAlarm.instructions || ""}
      onTake={handleTake}
      onSnooze={handleSnooze}
      onDismiss={handleDismiss}
    />
  );
};
