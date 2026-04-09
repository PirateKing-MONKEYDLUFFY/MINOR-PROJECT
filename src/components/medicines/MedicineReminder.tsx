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
    const today = format(new Date(), "yyyy-MM-dd");
    if (saved) {
      const parsed = JSON.parse(saved);
      if (parsed?._date !== today) return { _date: today };
      return parsed;
    }
    return { _date: today };
  });

  const [dbLogs, setDbLogs] = useState<any[]>([]);

  useEffect(() => {
    localStorage.setItem("medicine_doses_state", JSON.stringify(dosesState));
  }, [dosesState]);

  // Fetch medicines and their logs for today
  const fetchMedicines = useCallback(async () => {
    if (!profile) return;
    try {
      console.log("[MedicineAlarm] Syncing with database...");
      let targetIds = [profile.id];

      if (profile.role === "caregiver") {
        const { data: connections } = await supabase
          .from("family_connections")
          .select("elder_id")
          .eq("caregiver_id", profile.id);
        
        if (connections && connections.length > 0) {
          const elderIds = connections.map(c => c.elder_id);
          targetIds = [...targetIds, ...elderIds];
        }
      }

      // Fetch medicines
      const { data: meds, error: medsErr } = await supabase
        .from("medicines")
        .select("id, name, dosage, times, instructions")
        .in("elder_id", targetIds)
        .eq("is_active", true);

      if (medsErr) throw medsErr;
      setMedicines(meds || []);

      // Fetch today's logs to synchronize state
      const todayString = format(new Date(), "yyyy-MM-dd");
      const { data: logs, error: logsErr } = await supabase
        .from("medicine_logs")
        .select("medicine_id, scheduled_time, status")
        .gte("scheduled_time", `${todayString}T00:00:00`)
        .lte("scheduled_time", `${todayString}T23:59:59`);
      
      if (logsErr) throw logsErr;
      setDbLogs(logs || []);
      
      console.log(`[MedicineAlarm] Sync complete. ${meds?.length || 0} medicines, ${logs?.length || 0} logs found.`);
    } catch (err) {
      console.error("MedicineReminder: Error during sync:", err);
    }
  }, [profile]);

  useEffect(() => {
    fetchMedicines();
    // Poll every 60 seconds
    const pollInterval = setInterval(fetchMedicines, 60000);
    return () => clearInterval(pollInterval);
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
    console.log(`[MedicineAlarm] Triggering alarm for: ${med.name}`);
    if (!audioRef.current) {
      audioRef.current = new Audio(ALARM_URL);
      audioRef.current.loop = true;
    }
    
    audioRef.current.play().catch(e => {
      console.warn("Alarm audio blocked or failed, using TTS fallback:", e);
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
      fetchMedicines(); // Refresh logs
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
    if (activeAlarm) return;

    const now = new Date();
    const currentTime = format(now, "HH:mm");

    medicines.forEach(med => {
      med.times.forEach(scheduledTime => {
        const key = `${med.id}-${scheduledTime}`;
        const localState = dosesState[key];
        
        // Check if already taken in DB
        const isTakenInDb = dbLogs.some(log => 
          log.medicine_id === med.id && 
          log.status === "taken" &&
          format(new Date(log.scheduled_time), "HH:mm") === scheduledTime
        );

        if (isTakenInDb) {
          // Already taken, don't ring
          return;
        }

        // 1. Standard minute check
        if (currentTime === scheduledTime) {
          if (!localState || localState === "pending") {
            setActiveAlarm(med);
            playAlarm(med);
          }
        }

        // 2. Snooze check
        if (localState?.startsWith("snoozed-")) {
          const snoozeUntil = new Date(localState.split("snoozed-")[1]);
          if (isAfter(now, snoozeUntil)) {
            setActiveAlarm(med);
            playAlarm(med);
          }
        }
      });
    });
  }, [activeAlarm, medicines, dosesState, dbLogs, playAlarm]);

  useEffect(() => {
    // Check for ring trigger every 15 seconds for responsiveness
    checkIntervalRef.current = setInterval(checkReminders, 15000);
    return () => clearInterval(checkIntervalRef.current);
  }, [checkReminders]);

  if (!activeAlarm) return null;

  return (
    <AlarmOverlay
      medicineName={activeAlarm.name}
      dosage={activeAlarm.dosage}
      instructions={activeAlarm.instructions || ""}
      onTake={handleTake}
      onDismiss={handleDismiss}
    />
  );
};
