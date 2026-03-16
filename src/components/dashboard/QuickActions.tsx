import { Pill, Phone, User } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";

interface QuickAction {
  id: string;
  icon: React.ReactNode;
  label: string;
  description: string;
  color: string;
  onClick?: () => void;
}

const QUICK_ACTIONS: QuickAction[] = [
  {
    id: "medicines",
    icon: <Pill className="h-8 w-8" />,
    label: "My Medicines",
    description: "View today's schedule",
    color: "bg-success/10 text-success",
  },
  {
    id: "contacts",
    icon: <Phone className="h-8 w-8" />,
    label: "Call Family",
    description: "Quick dial contacts",
    color: "bg-warning/10 text-warning",
  },
  {
    id: "profile",
    icon: <User className="h-8 w-8" />,
    label: "My Profile",
    description: "Settings & info",
    color: "bg-secondary text-secondary-foreground",
  },
];

interface QuickActionsProps {
  onActionClick?: (actionId: string) => void;
}

export function QuickActions({ onActionClick }: QuickActionsProps) {
  return (
    <section>
      <h2 className="text-2xl font-bold text-foreground mb-4">Quick Actions</h2>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {QUICK_ACTIONS.map((action) => (
          <Card
            key={action.id}
            onClick={() => onActionClick?.(action.id)}
            className={cn(
              "cursor-pointer transition-all duration-200",
              "hover:shadow-lg hover:scale-[1.02]",
              "active:scale-[0.98]"
            )}
            role="button"
            tabIndex={0}
          >
            <CardContent className="p-4 md:p-6 text-center">
              <div
                className={cn(
                  "mx-auto mb-3 flex h-16 w-16 items-center justify-center rounded-2xl",
                  action.color
                )}
              >
                {action.icon}
              </div>
              <h3 className="text-lg font-semibold text-foreground">
                {action.label}
              </h3>
              <p className="text-sm text-muted-foreground mt-1">
                {action.description}
              </p>
            </CardContent>
          </Card>
        ))}
      </div>
    </section>
  );
}
