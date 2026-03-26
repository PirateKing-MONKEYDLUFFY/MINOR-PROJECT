import { forwardRef } from "react";
import { Phone } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { motion } from "framer-motion";

interface SOSButtonProps {
  className?: string;
  onClick?: () => void;
}

export const SOSButton = forwardRef<HTMLButtonElement, SOSButtonProps>(
  ({ className, onClick }, ref) => {
    return (
      <motion.div
        initial={{ scale: 0, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ type: "spring", delay: 0.5 }}
        className="fixed bottom-6 right-6 z-50"
      >
        <Button
          ref={ref}
          onClick={onClick}
          className={cn(
            "h-20 w-20 rounded-full",
            "bg-emergency hover:bg-emergency/90 text-emergency-foreground",
            "shadow-2xl sos-pulse",
            "flex flex-col items-center justify-center gap-1",
            "text-lg font-bold",
            "md:h-24 md:w-24 md:text-xl",
            className
          )}
          aria-label="Emergency SOS - Call for help"
        >
          <Phone className="h-8 w-8 md:h-10 md:w-10" />
          <span>SOS</span>
        </Button>
      </motion.div>
    );
  }
);

SOSButton.displayName = "SOSButton";
