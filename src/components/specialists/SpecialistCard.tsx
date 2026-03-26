import { forwardRef } from "react";
import { Specialist } from "@/types/specialists";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Mic, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";
import { motion } from "framer-motion";

interface SpecialistCardProps {
  specialist: Specialist;
  onClick?: () => void;
  className?: string;
}

export const SpecialistCard = forwardRef<HTMLDivElement, SpecialistCardProps>(
  ({ specialist, onClick, className }, ref) => {
    return (
      <motion.div
        ref={ref}
        whileHover={{ scale: 1.02, y: -2 }}
        whileTap={{ scale: 0.98 }}
      >
        <Card
          className={cn(
            "cursor-pointer transition-all duration-300",
            "hover:shadow-lg hover:border-primary/40",
            "group relative overflow-hidden",
            className
          )}
          onClick={onClick}
        >
          {/* Subtle gradient overlay on hover */}
          <div className="absolute inset-0 bg-gradient-to-br from-primary/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
          
          <CardContent className="p-4 relative">
            <div className="flex items-start gap-4">
              {/* Avatar with animation */}
              <motion.div 
                className="flex h-14 w-14 items-center justify-center rounded-2xl bg-primary/10 text-3xl shrink-0 group-hover:bg-primary/20 transition-colors"
                whileHover={{ rotate: [0, -5, 5, 0] }}
                transition={{ duration: 0.3 }}
              >
                {specialist.emoji}
              </motion.div>

              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between gap-2 mb-1">
                  <h3 className="font-semibold text-base truncate group-hover:text-primary transition-colors">
                    {specialist.name}
                  </h3>
                  <ChevronRight className="h-4 w-4 text-muted-foreground group-hover:text-primary group-hover:translate-x-1 transition-all" />
                </div>
                
                <p className="text-sm text-primary/80 font-medium mb-1">
                  {specialist.title}
                </p>
                
                <p className="text-sm text-muted-foreground line-clamp-2">
                  {specialist.description}
                </p>
              </div>
            </div>

            {/* Voice indicator */}
            <div className="flex items-center gap-2 mt-3 pt-3 border-t border-border/50">
              <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                <Mic className="h-3.5 w-3.5 text-primary" />
                <span>Voice-enabled</span>
              </div>
              <Badge variant="secondary" className="ml-auto text-xs">
                AI
              </Badge>
            </div>
          </CardContent>
        </Card>
      </motion.div>
    );
  }
);

SpecialistCard.displayName = "SpecialistCard";
