import { motion } from "framer-motion";
import { Pill, Bell, Check, Clock, X } from "lucide-react";
import { Button } from "@/components/ui/button";

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
  onDismiss
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

        <div className="bg-white/10 rounded-2xl p-6 mb-10 border border-white/20">
          <div className="flex items-center justify-center gap-2 mb-2">
            <Bell className="h-5 w-5" />
            <span className="text-lg font-medium">{dosage}</span>
          </div>
          {instructions && (
            <p className="text-white/80">{instructions}</p>
          )}
        </div>

        <div className="grid gap-4">
          <Button
            size="lg"
            onClick={onTake}
            className="h-20 text-2xl bg-white text-primary hover:bg-white/90 shadow-xl rounded-full"
          >
            <Check className="h-8 w-8 mr-3" />
            I've Taken It
          </Button>

          <div className="grid grid-cols-2 gap-4">
            <Button
              variant="outline"
              size="lg"
              onClick={onSnooze}
              className="h-16 text-lg border-white text-white hover:bg-white/20 rounded-full"
            >
              <Clock className="h-5 w-5 mr-2" />
              Snooze (5m)
            </Button>
            <Button
              variant="ghost"
              size="lg"
              onClick={onDismiss}
              className="h-16 text-lg text-white/70 hover:text-white hover:bg-white/10 rounded-full"
            >
              <X className="h-5 w-5 mr-2" />
              Dismiss
            </Button>
          </div>
        </div>
      </div>
    </motion.div>
  );
};
