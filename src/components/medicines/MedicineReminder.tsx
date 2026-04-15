import { useState, useEffect, useRef, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { AlarmOverlay } from "./AlarmOverlay";
import { toast } from "@/hooks/use-toast";
import { format, addMinutes, isAfter, differenceInMinutes, parse } from "date-fns";
import { useTextToSpeech } from "@/hooks/useTextToSpeech";

// How many minutes past scheduled time we still trigger the alarm
const ALARM_WINDOW_MINUTES = 3;

/** Play a professional triple-beep chime using Web Audio API */
function startBeep(audioCtxRef: React.MutableRefObject<AudioContext | null>, beepNodeRef: React.MutableRefObject<any>) {
  try {
    if (!audioCtxRef.current || audioCtxRef.current.state === "closed") {
      audioCtxRef.current = new AudioContext();
    }
    const ctx = audioCtxRef.current;

    ctx.resume().then(() => {
      const playChime = () => {
        const now = ctx.currentTime;
        [0, 0.2, 0.4].forEach((delay) => {
          const osc = ctx.createOscillator();
          const gain = ctx.createGain();
          osc.connect(gain);
          gain.connect(ctx.destination);
          
          // Medical-style chime (sine wave with a bit of triangle)
          osc.type = "sine";
          osc.frequency.setValueAtTime(987.77, now + delay); // B5 note
          
          gain.gain.setValueAtTime(0, now + delay);
          gain.gain.linearRampToValueAtTime(0.4, now + delay + 0.05);
          gain.gain.exponentialRampToValueAtTime(0.001, now + delay + 0.15);
          
          osc.start(now + delay);
          osc.stop(now + delay + 0.15);
        });
      };

      playChime();
      // Repeat every 2 seconds
      beepNodeRef.current = setInterval(playChime, 2000);
    });
  } catch (e) {
    console.warn("[MedicineAlarm] Web Audio API error:", e);
  }
}

function stopBeep(beepNodeRef: React.MutableRefObject<any>) {
  if (beepNodeRef.current) {
    clearInterval(beepNodeRef.current);
    beepNodeRef.current = null;
  }
}

interface Medicine {
  id: string;
  name: string;
  dosage: string;
  times: string[];
  instructions: string | null;
}

export const MedicineReminder = () => {
  const { profile } = useAuth();
  const [activeAlarm, setActiveAlarm] = useState<{ med: Medicine; scheduledTime: string } | null>(null);
  const [medicines, setMedicines] = useState<Medicine[]>([]);
  const { speak, stop: stopTTS } = useTextToSpeech();
  const audioCtxRef = useRef<AudioContext | null>(null);
  const beepNodeRef = useRef<any>(null);
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
          const elderIds = connections.map((c) => c.elder_id);
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

      console.log(
        `[MedicineAlarm] Sync complete. ${meds?.length || 0} medicines, ${logs?.length || 0} logs found.`
      );
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
    stopBeep(beepNodeRef);
    stopTTS();
    setActiveAlarm(null);
  }, [stopTTS]);

  const playAlarm = useCallback(
    (med: Medicine, scheduledTime: string) => {
      console.log(`[MedicineAlarm] Triggering alarm for: ${med.name} (scheduled: ${scheduledTime})`);
      // Show visual overlay immediately with the specific schedule info
      setActiveAlarm({ med, scheduledTime });
      // Start Web Audio beep — works offline and isn't blocked by autoplay policy
      startBeep(audioCtxRef, beepNodeRef);
    },
    []
  );

  const handleTake = async () => {
    if (!activeAlarm) return;
    const { med, scheduledTime } = activeAlarm;
    const key = `${med.id}-${scheduledTime}`;

    try {
      // Calculate the correct scheduled_time for today to match in DB
      const today = format(new Date(), "yyyy-MM-dd");
      const scheduledISO = new Date(`${today}T${scheduledTime}:00`).toISOString();

      await supabase.from("medicine_logs").insert({
        medicine_id: med.id,
        scheduled_time: scheduledISO,
        status: "taken",
        taken_at: new Date().toISOString(),
      });

      setDosesState((prev) => ({ ...prev, [key]: "dismissed" }));
      stopAlarm();
      toast({ title: "Medicine Logged", description: `${med.name} marked as taken.` });
      fetchMedicines();
    } catch (err) {
      console.error("Error logging medicine:", err);
    }
  };

  const handleSnooze = () => {
    if (!activeAlarm) return;
    const { med, scheduledTime } = activeAlarm;
    const key = `${med.id}-${scheduledTime}`;
    const snoozeUntil = addMinutes(new Date(), 5).toISOString();

    setDosesState((prev) => ({ ...prev, [key]: `snoozed-${snoozeUntil}` }));
    stopAlarm();
    toast({ title: "Snoozed", description: "Alarm will ring again in 5 minutes." });
  };

  const handleDismiss = () => {
    if (!activeAlarm) return;
    const { med, scheduledTime } = activeAlarm;
    const key = `${med.id}-${scheduledTime}`;
    setDosesState((prev) => ({ ...prev, [key]: "dismissed" }));
    stopAlarm();
  };

  const checkReminders = useCallback(() => {
    if (activeAlarm) return;

    const now = new Date();
    const today = format(now, "yyyy-MM-dd");

    medicines.forEach((med) => {
      med.times.forEach((scheduledTime) => {
        const key = `${med.id}-${scheduledTime}`;
        const localState = dosesState[key];

        // Skip if already taken in DB
        const isTakenInDb = dbLogs.some(
          (log) =>
            log.medicine_id === med.id &&
            log.status === "taken" &&
            format(new Date(log.scheduled_time), "HH:mm") === scheduledTime
        );

        if (isTakenInDb || localState === "dismissed") {
          return;
        }

        // 1. Snooze check — re-fire if snooze time has passed
        if (localState?.startsWith("snoozed-")) {
          const snoozeUntil = new Date(localState.split("snoozed-")[1]);
          if (isAfter(now, snoozeUntil)) {
            console.log(`[MedicineAlarm] Snoozed alarm re-triggering for: ${med.name}`);
            playAlarm(med, scheduledTime);
          }
          return;
        }

        // 2. Window check: fire alarm if within ALARM_WINDOW_MINUTES past the scheduled time.
        const scheduledDate = parse(
          scheduledTime,
          "HH:mm",
          new Date(`${today}T00:00:00`)
        );
        const minutesPast = differenceInMinutes(now, scheduledDate);

        if (minutesPast >= 0 && minutesPast <= ALARM_WINDOW_MINUTES) {
          if (!localState || localState === "pending") {
            console.log(
              `[MedicineAlarm] Window trigger for: ${med.name} (${minutesPast}min past ${scheduledTime})`
            );
            playAlarm(med, scheduledTime);
          }
        }
      });
    });
  }, [activeAlarm, medicines, dosesState, dbLogs, playAlarm]);

  // Check every 15 seconds
  useEffect(() => {
    checkIntervalRef.current = setInterval(checkReminders, 15000);
    return () => clearInterval(checkIntervalRef.current);
  }, [checkReminders]);

  // Also check immediately when user switches back to this tab
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.visibilityState === "visible") {
        console.log("[MedicineAlarm] Tab became visible — checking alarms immediately.");
        checkReminders();
      }
    };
    document.addEventListener("visibilitychange", handleVisibilityChange);
    return () => document.removeEventListener("visibilitychange", handleVisibilityChange);
  }, [checkReminders]);

  return (
    <>
      {activeAlarm && (
        <AlarmOverlay
          medicineName={activeAlarm.med.name}
          dosage={activeAlarm.med.dosage}
          instructions={activeAlarm.med.instructions || ""}
          onTake={handleTake}
          onSnooze={handleSnooze}
          onDismiss={handleDismiss}
        />
      )}
    </>
  );
};
