import { motion } from "framer-motion";
import { Pill, Bell, Check, X, Clock } from "lucide-react";

interface AlarmOverlayProps {
  medicineName: string;
  dosage: string;
  instructions?: string;
  onTake: () => void;
  onSnooze: () => void;
  onDismiss: () => void;
}

export const AlarmOverlay = ({
  medicineName,
  dosage,
  instructions,
  onTake,
  onSnooze,
  onDismiss,
}: AlarmOverlayProps) => {
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-[200] flex items-center justify-center p-4 bg-primary/95 backdrop-blur-md"
    >
      <div className="max-w-md w-full text-center text-white">
        <motion.div
          animate={{ scale: [1, 1.1, 1], rotate: [0, -5, 5, 0] }}
          transition={{ repeat: Infinity, duration: 1.5 }}
          className="mb-8"
        >
          <div className="h-24 w-24 bg-white rounded-full flex items-center justify-center mx-auto shadow-2xl">
            <Pill className="h-12 w-12 text-primary" />
          </div>
        </motion.div>

        <h1 className="text-4xl font-bold mb-2">Medicine Time!</h1>
        <p className="text-2xl font-semibold mb-6 opacity-90">
          Please take your {medicineName}
        </p>

        <div className="bg-white/10 rounded-2xl p-6 mb-8 border border-white/20">
          <div className="flex items-center justify-center gap-2 mb-2">
            <Bell className="h-5 w-5" />
            <span className="text-lg font-medium">{dosage}</span>
          </div>
          {instructions && (
            <p className="text-white/80 text-sm">{instructions}</p>
          )}
        </div>

        <div className="flex flex-col gap-3">
          {/* Primary: Take */}
          <button
            onClick={onTake}
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              gap: "12px",
              height: "80px",
              fontSize: "22px",
              fontWeight: "bold",
              background: "#ffffff",
              color: "#0f6b3a",
              border: "none",
              borderRadius: "9999px",
              cursor: "pointer",
              boxShadow: "0 8px 24px rgba(0,0,0,0.2)",
              width: "100%",
            }}
          >
            <Check style={{ width: "28px", height: "28px", color: "#0f6b3a", flexShrink: 0 }} />
            <span style={{ color: "#0f6b3a" }}>I&apos;ve Taken It</span>
          </button>

          {/* Snooze */}
          <button
            onClick={onSnooze}
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              gap: "10px",
              height: "60px",
              fontSize: "18px",
              fontWeight: "600",
              background: "rgba(255,255,255,0.15)",
              color: "#ffffff",
              border: "2px solid rgba(255,255,255,0.6)",
              borderRadius: "9999px",
              cursor: "pointer",
              width: "100%",
            }}
          >
            <Clock style={{ width: "20px", height: "20px" }} />
            Snooze 5 min
          </button>

          {/* Dismiss */}
          <button
            onClick={onDismiss}
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              gap: "8px",
              height: "48px",
              fontSize: "15px",
              fontWeight: "500",
              background: "transparent",
              color: "rgba(255,255,255,0.6)",
              border: "1px solid rgba(255,255,255,0.2)",
              borderRadius: "9999px",
              cursor: "pointer",
              width: "100%",
            }}
          >
            <X style={{ width: "18px", height: "18px" }} />
            Dismiss
          </button>
        </div>
      </div>
    </motion.div>
  );
};
