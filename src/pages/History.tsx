import { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import { Header } from "@/components/layout/Header";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Clock, MessageSquare, ArrowRight, Trash2 } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

// Consultation history stored in localStorage
export interface ConsultationRecord {
  id: string;
  specialistId: string;
  specialistName: string;
  specialistTitle: string;
  emoji: string;
  date: string;
  summary: string;
  messages: number;
}

// Helper to get consultation history from localStorage
export function getConsultationHistory(): ConsultationRecord[] {
  try {
    const history = localStorage.getItem("voiceaid_history");
    return history ? JSON.parse(history) : [];
  } catch {
    return [];
  }
}

// Helper to save consultation to history
export function saveConsultation(consultation: Omit<ConsultationRecord, "id" | "date">) {
  const history = getConsultationHistory();
  const newRecord: ConsultationRecord = {
    ...consultation,
    id: Date.now().toString(),
    date: new Date().toISOString(),
  };
  history.unshift(newRecord); // Add to beginning
  // Keep only last 20 consultations
  const trimmed = history.slice(0, 20);
  localStorage.setItem("voiceaid_history", JSON.stringify(trimmed));
  return newRecord;
}

// Helper to clear history
export function clearHistory() {
  localStorage.removeItem("voiceaid_history");
}

function formatDate(dateString: string): string {
  const date = new Date(dateString);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

  if (diffHours < 1) {
    return "Just now";
  } else if (diffHours < 24) {
    return `${diffHours} hour${diffHours > 1 ? "s" : ""} ago`;
  } else if (diffDays === 1) {
    return "Yesterday";
  } else if (diffDays < 7) {
    return `${diffDays} days ago`;
  } else {
    return date.toLocaleDateString("en-US", { month: "short", day: "numeric" });
  }
}

export default function History() {
  const [showMenu, setShowMenu] = useState(false);
  const [history, setHistory] = useState<ConsultationRecord[]>([]);

  useEffect(() => {
    setHistory(getConsultationHistory());
  }, []);

  const handleClearHistory = () => {
    clearHistory();
    setHistory([]);
  };

  const handleDeleteItem = (id: string) => {
    const newHistory = history.filter((item) => item.id !== id);
    localStorage.setItem("voiceaid_history", JSON.stringify(newHistory));
    setHistory(newHistory);
  };

  return (
    <div className="min-h-screen bg-background">
      <Header onMenuToggle={() => setShowMenu(!showMenu)} showMenu={showMenu} />

      <main className="container py-6">
        <motion.div 
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          className="mb-6 flex items-center justify-between"
        >
          <div>
            <h1 className="text-2xl font-bold flex items-center gap-2">
              <Clock className="h-6 w-6 text-primary" />
              Consultation History
            </h1>
            <p className="text-muted-foreground">Your past conversations with specialists</p>
          </div>
          
          {history.length > 0 && (
            <Button
              variant="outline"
              size="sm"
              onClick={handleClearHistory}
              className="text-destructive hover:text-destructive"
            >
              <Trash2 className="h-4 w-4 mr-2" />
              Clear All
            </Button>
          )}
        </motion.div>

        <AnimatePresence mode="popLayout">
          {history.length > 0 ? (
            <motion.div 
              className="space-y-4 max-w-2xl"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
            >
              {history.map((consultation, index) => (
                <motion.div
                  key={consultation.id}
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: 20 }}
                  transition={{ delay: index * 0.05 }}
                >
                  <Card className="hover:shadow-md transition-all duration-300 hover:border-primary/30 group">
                    <CardContent className="p-4">
                      <div className="flex items-start gap-4">
                        <motion.div 
                          className="flex h-12 w-12 items-center justify-center rounded-full bg-secondary text-2xl shrink-0"
                          whileHover={{ scale: 1.1 }}
                        >
                          {consultation.emoji}
                        </motion.div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center justify-between gap-2">
                            <h3 className="font-semibold">{consultation.specialistName}</h3>
                            <span className="text-sm text-muted-foreground shrink-0">
                              {formatDate(consultation.date)}
                            </span>
                          </div>
                          <p className="text-sm text-primary/80">{consultation.specialistTitle}</p>
                          <p className="text-sm text-muted-foreground mt-1 line-clamp-2">
                            {consultation.summary}
                          </p>
                          <div className="flex items-center justify-between mt-3">
                            <span className="text-xs text-muted-foreground flex items-center gap-1">
                              <MessageSquare className="h-3 w-3" />
                              {consultation.messages} messages
                            </span>
                            <div className="flex items-center gap-2">
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => handleDeleteItem(consultation.id)}
                                className="opacity-0 group-hover:opacity-100 transition-opacity text-destructive hover:text-destructive"
                              >
                                <Trash2 className="h-4 w-4" />
                              </Button>
                              <Button 
                                variant="ghost" 
                                size="sm" 
                                className="text-primary"
                                asChild
                              >
                                <Link to={`/consultation/${consultation.specialistId}`}>
                                  Continue
                                  <ArrowRight className="h-4 w-4 ml-1" />
                                </Link>
                              </Button>
                            </div>
                          </div>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                </motion.div>
              ))}
            </motion.div>
          ) : (
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
            >
              <Card className="max-w-md">
                <CardContent className="p-8 text-center">
                  <motion.div
                    initial={{ scale: 0 }}
                    animate={{ scale: 1 }}
                    transition={{ type: "spring", delay: 0.2 }}
                  >
                    <Clock className="h-16 w-16 mx-auto text-muted-foreground/50 mb-4" />
                  </motion.div>
                  <h3 className="text-lg font-semibold mb-2">No Consultations Yet</h3>
                  <p className="text-muted-foreground mb-6">
                    Start your first conversation with one of our friendly AI specialists.
                  </p>
                  <Button asChild size="lg" className="rounded-full">
                    <Link to="/dashboard">
                      Browse Specialists
                      <ArrowRight className="ml-2 h-4 w-4" />
                    </Link>
                  </Button>
                </CardContent>
              </Card>
            </motion.div>
          )}
        </AnimatePresence>
      </main>
    </div>
  );
}
