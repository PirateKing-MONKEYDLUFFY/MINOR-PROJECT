import { useState, useRef, useEffect, useCallback } from "react";
import { useParams, useNavigate, Link, useLocation } from "react-router-dom";
import { ArrowLeft, Mic, MicOff, Send, Volume2, VolumeX } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { SPECIALISTS } from "@/types/specialists";
import { cn } from "@/lib/utils";
import { toast } from "@/hooks/use-toast";
import { useSpeechRecognition } from "@/hooks/useSpeechRecognition";
import { useTextToSpeech } from "@/hooks/useTextToSpeech";
import { saveConsultation } from "@/pages/History";
import { motion, AnimatePresence } from "framer-motion";

interface Message {
  id: string;
  role: "user" | "assistant";
  content: string;
  timestamp: Date;
}

interface LocationState {
  initialMessage?: string;
  fromTriage?: boolean;
}

export default function Consultation() {
  const { specialistId } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  const locationState = location.state as LocationState;
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  
  const specialist = SPECIALISTS.find((s) => s.id === specialistId);
  
  const [messages, setMessages] = useState<Message[]>([]);
  const [inputText, setInputText] = useState("");
  const [isTTSEnabled, setIsTTSEnabled] = useState(true);
  const [isLoading, setIsLoading] = useState(false);
  const hasGreetedRef = useRef(false);

  // Voice hooks
  const { speak, stop: stopSpeaking, isSpeaking } = useTextToSpeech({
    voiceGender: specialist?.id.includes("emma") || specialist?.id.includes("maria") || specialist?.id.includes("carol") ? "female" : "male",
  });

  const { 
    isListening, 
    transcript, 
    startListening,
    stopListening, 
    isSupported: speechSupported 
  } = useSpeechRecognition({
    continuous: true,
    autoStopTimeout: 10000,
    onResult: (result) => {
      // Direct send when voice completes to avoid state closure issues
      if (result.trim()) {
        handleSendMessage(result);
      }
    },
  });

  // Update input when transcript changes
  useEffect(() => {
    if (transcript) {
      setInputText(transcript);
    }
  }, [transcript]);

  // Scroll to bottom when messages change
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  // Initial greeting with TTS
  useEffect(() => {
    // If we have an initial message (from triage), we delay the greeting
    // to prevent overlapping audio.
    if (specialist && !hasGreetedRef.current) {
      const initialMessage = locationState?.initialMessage;
      
      const setupGreeting = () => {
        const greeting = `Hello! I'm ${specialist.name}, your ${specialist.title}. How can I help you today? Just speak or type your question.`;
        
        const greetingMessage: Message = {
          id: "greeting",
          role: "assistant",
          content: greeting,
          timestamp: new Date(),
        };
        setMessages([greetingMessage]);
        hasGreetedRef.current = true;

        if (isTTSEnabled) {
          speak(greeting);
        }
      };

      if (initialMessage) {
        // Wait a small bit to let the triage message process first
        const timeout = setTimeout(setupGreeting, 1000);
        return () => clearTimeout(timeout);
      } else {
        setupGreeting();
      }
    }
  }, [specialist, isTTSEnabled, speak, locationState]);

  // Save consultation to history when leaving
  useEffect(() => {
    return () => {
      if (specialist && messages.length > 1) {
        const userMessages = messages.filter(m => m.role === "user");
        if (userMessages.length > 0) {
          saveConsultation({
            specialistId: specialist.id,
            specialistName: specialist.name,
            specialistTitle: specialist.title,
            emoji: specialist.emoji,
            summary: userMessages[0].content.slice(0, 100) + (userMessages[0].content.length > 100 ? "..." : ""),
            messages: messages.length,
          });
        }
      }
    };
  }, [specialist, messages]);

  const handleSendMessage = useCallback(async (textOverride?: string) => {
    const textToSend = (textOverride || inputText).trim();
    if (!textToSend || isLoading) return;

    // Atomic send setup
    setInputText("");
    setIsLoading(true);

    // Stop any current speech
    stopSpeaking();

    const userMessage: Message = {
      id: Date.now().toString(),
      role: "user",
      content: textToSend,
      timestamp: new Date(),
    };

    setMessages((prev) => [...prev, userMessage]);
    setInputText("");
    setIsLoading(true);

    try {
      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/medical-chat`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
          },
          body: JSON.stringify({
            messages: [...messages, userMessage].map((m) => ({
              role: m.role,
              content: m.content,
            })),
            specialistId: specialist?.id,
            systemPrompt: specialist?.systemPrompt,
          }),
        }
      );

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        console.error("AI Service Error Response:", {
          status: response.status,
          statusText: response.statusText,
          data: errorData
        });
        throw new Error(`Failed to get response: ${response.status} ${errorData.error || ""}`);
      }

      const data = await response.json();

      const assistantMessage: Message = {
        id: (Date.now() + 1).toString(),
        role: "assistant",
        content: data.content || "I'm sorry, could you say that again?",
        timestamp: new Date(),
      };

      setMessages((prev) => [...prev, assistantMessage]);

      // Speak the response if TTS enabled
      if (isTTSEnabled && data.content) {
        speak(data.content);
      }
    } catch (error: any) {
      console.error("Connection Error:", error);
      toast({
        title: "Connection Error",
        description: error.message.includes("404") 
          ? "The medical service is not deployed yet. Please run the deployment steps."
          : `Having trouble connecting: ${error.message}`,
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  }, [inputText, isLoading, messages, specialist, stopSpeaking, speak, isTTSEnabled]);

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  const handleVoiceToggle = () => {
    if (isListening) {
      stopListening();
    } else {
      stopSpeaking();
      startListening();
    }
  };

  if (!specialist) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Card className="p-8 text-center max-w-md">
          <h2 className="text-xl font-semibold mb-2">Specialist Not Found</h2>
          <p className="text-muted-foreground mb-4">
            The specialist you're looking for doesn't exist.
          </p>
          <Button asChild>
            <Link to="/dashboard">Back to Dashboard</Link>
          </Button>
        </Card>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-screen bg-background">
      {/* Header */}
      <motion.header 
        initial={{ y: -20, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        className="sticky top-0 z-50 border-b border-border bg-background/95 backdrop-blur"
      >
        <div className="container flex h-16 items-center gap-4">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => navigate("/dashboard")}
            className="shrink-0"
          >
            <ArrowLeft className="h-5 w-5" />
          </Button>
          
          <div className="flex items-center gap-3 flex-1 min-w-0">
            <motion.div 
              className="flex h-12 w-12 items-center justify-center rounded-full bg-primary/10 text-2xl shrink-0"
              animate={isSpeaking ? { scale: [1, 1.05, 1] } : {}}
              transition={{ repeat: Infinity, duration: 1.5 }}
            >
              {specialist.emoji}
            </motion.div>
            <div className="min-w-0">
              <h1 className="font-semibold truncate text-lg">{specialist.name}</h1>
              <div className="flex items-center gap-2">
                <p className="text-sm text-muted-foreground truncate">{specialist.title}</p>
                {isSpeaking && (
                  <motion.span 
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    className="text-xs text-primary flex items-center gap-1"
                  >
                    <Volume2 className="h-3 w-3" />
                    Speaking...
                  </motion.span>
                )}
              </div>
            </div>
          </div>

          <Button
            variant={isTTSEnabled ? "default" : "outline"}
            size="icon"
            onClick={() => {
              setIsTTSEnabled(!isTTSEnabled);
              if (isTTSEnabled) stopSpeaking();
            }}
            className="shrink-0"
          >
            {isTTSEnabled ? <Volume2 className="h-5 w-5" /> : <VolumeX className="h-5 w-5" />}
          </Button>
        </div>
      </motion.header>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        <AnimatePresence initial={false}>
          {messages.map((message, index) => (
            <motion.div
              key={message.id}
              initial={{ opacity: 0, y: 20, scale: 0.95 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              transition={{ delay: index * 0.05 }}
              className={cn(
                "flex",
                message.role === "user" ? "justify-end" : "justify-start"
              )}
            >
              <div
                className={cn(
                  "max-w-[85%] md:max-w-[70%] rounded-2xl px-4 py-3 shadow-sm",
                  message.role === "user"
                    ? "bg-primary text-primary-foreground rounded-br-md"
                    : "bg-card border border-border rounded-bl-md"
                )}
              >
                <p className="text-base leading-relaxed whitespace-pre-wrap">{message.content}</p>
                <p
                  className={cn(
                    "text-xs mt-2",
                    message.role === "user"
                      ? "text-primary-foreground/70"
                      : "text-muted-foreground"
                  )}
                >
                  {message.timestamp.toLocaleTimeString([], {
                    hour: "2-digit",
                    minute: "2-digit",
                  })}
                </p>
              </div>
            </motion.div>
          ))}
        </AnimatePresence>

        {isLoading && (
          <motion.div 
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="flex justify-start"
          >
            <div className="bg-card border border-border rounded-2xl rounded-bl-md px-4 py-3">
              <div className="flex items-center gap-3">
                <div className="flex gap-1">
                  {[0, 1, 2].map((i) => (
                    <motion.div
                      key={i}
                      className="w-2 h-2 rounded-full bg-primary"
                      animate={{ y: [0, -6, 0] }}
                      transition={{ repeat: Infinity, duration: 0.6, delay: i * 0.1 }}
                    />
                  ))}
                </div>
                <span className="text-sm text-muted-foreground">Thinking...</span>
              </div>
            </div>
          </motion.div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* Disclaimer */}
      <div className="px-4 py-2 bg-warning/10 border-t border-warning/20">
        <p className="text-xs text-center text-warning-foreground">
          ⚠️ For informational purposes only. Always consult a real doctor for medical advice.
        </p>
      </div>

      {/* Voice-First Input Area */}
      <div className="border-t border-border bg-background p-4 pb-6">
        <div className="container max-w-4xl mx-auto">
          {/* Primary Voice Button */}
          <div className="flex flex-col items-center mb-4">
            <motion.div
              animate={isListening ? { scale: [1, 1.1, 1] } : {}}
              transition={{ repeat: Infinity, duration: 1 }}
            >
              <Button
                size="lg"
                onClick={handleVoiceToggle}
                disabled={!speechSupported}
                className={cn(
                  "h-20 w-20 rounded-full shadow-lg transition-all duration-300",
                  isListening 
                    ? "bg-destructive hover:bg-destructive/90 animate-pulse" 
                    : "bg-primary hover:bg-primary/90"
                )}
              >
                {isListening ? (
                  <MicOff className="h-8 w-8" />
                ) : (
                  <Mic className="h-8 w-8" />
                )}
              </Button>
            </motion.div>
            <p className="text-sm text-muted-foreground mt-2">
              {isListening ? "Listening... Tap to stop" : "Tap to speak"}
            </p>
          </div>

          {/* Text Input (secondary) */}
          <div className="flex items-center gap-2">
            <Input
              ref={inputRef}
              value={inputText}
              onChange={(e) => setInputText(e.target.value)}
              onKeyPress={handleKeyPress}
              placeholder={isListening ? "Listening..." : "Or type your message..."}
              disabled={isListening || isLoading}
              className="h-12 text-base rounded-full px-5"
            />

            <Button
                onClick={() => handleSendMessage()}
              disabled={!inputText.trim() || isLoading}
              size="icon"
              className="shrink-0 h-12 w-12 rounded-full"
            >
              <Send className="h-5 w-5" />
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
