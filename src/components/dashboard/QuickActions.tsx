import { Pill, Phone } from "lucide-react";
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
];

interface QuickActionsProps {
  onActionClick?: (actionId: string) => void;
}

export function QuickActions({ onActionClick }: QuickActionsProps) {
  return (
    <section className="py-2">
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-2xl font-bold text-foreground">Health & Family</h2>
      </div>
      
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 lg:gap-8 max-w-4xl mx-auto">
        {QUICK_ACTIONS.map((action) => (
          <Card
            key={action.id}
            onClick={() => onActionClick?.(action.id)}
            className={cn(
              "cursor-pointer transition-all duration-300 overflow-hidden group",
              "hover:shadow-2xl hover:scale-[1.03] border-2 hover:border-primary/40",
              "active:scale-[0.98] h-full"
            )}
            role="button"
            tabIndex={0}
          >
            <CardContent className="p-8 flex flex-col items-center text-center">
              <div
                className={cn(
                  "mb-6 flex h-24 w-24 items-center justify-center rounded-3xl shadow-lg transition-transform group-hover:rotate-6",
                  action.color
                )}
              >
                <div className="scale-125">{action.icon}</div>
              </div>
              <h3 className="text-2xl font-bold text-foreground mb-2">
                {action.label}
              </h3>
              <p className="text-lg text-muted-foreground">
                {action.description}
              </p>
            </CardContent>
          </Card>
        ))}
      </div>
    </section>
  );
}
