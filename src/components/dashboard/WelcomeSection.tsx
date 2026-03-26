import { Mic, MessageCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";

interface WelcomeSectionProps {
  userName?: string;
}

export function WelcomeSection({ userName = "there" }: WelcomeSectionProps) {
  const getGreeting = () => {
    const hour = new Date().getHours();
    if (hour < 12) return "Good morning";
    if (hour < 18) return "Good afternoon";
    return "Good evening";
  };

  return (
    <Card className="bg-gradient-to-br from-primary/10 via-primary/5 to-transparent border-primary/20">
      <CardContent className="p-6 md:p-8">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-6">
          {/* Greeting */}
          <div>
            <h1 className="text-3xl md:text-4xl font-bold text-foreground">
              {getGreeting()}, {userName}! 👋
            </h1>
            <p className="mt-2 text-xl text-muted-foreground">
              How can I help you today? Choose a specialist or tell me what's on your mind.
            </p>
          </div>

          {/* Quick Actions */}
          <div className="flex gap-3">
            <Button
              size="lg"
              className="h-16 px-6 text-lg gap-3"
            >
              <Mic className="h-6 w-6" />
              <span className="hidden sm:inline">Speak to me</span>
              <span className="sm:hidden">Speak</span>
            </Button>
            <Button
              variant="outline"
              size="lg"
              className="h-16 px-6 text-lg gap-3"
            >
              <MessageCircle className="h-6 w-6" />
              <span className="hidden sm:inline">Type a message</span>
              <span className="sm:hidden">Type</span>
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
