import { useState } from "react";
import { Link } from "react-router-dom";
import { Stethoscope, Mic, MessageSquare, Shield, Clock, ArrowRight, Brain } from "lucide-react";
import { Header } from "@/components/layout/Header";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";

const features = [
  {
    icon: <Mic className="h-6 w-6" />,
    title: "Voice Consultations",
    description: "Speak naturally with AI doctors who understand your symptoms and respond in real-time.",
  },
  {
    icon: <Brain className="h-6 w-6" />,
    title: "25+ Specialists",
    description: "Access cardiologists, neurologists, dermatologists, and more - all available 24/7.",
  },
  {
    icon: <Shield className="h-6 w-6" />,
    title: "Emergency SOS",
    description: "One-tap emergency button to instantly alert your family or call for help.",
  },
  {
    icon: <Clock className="h-6 w-6" />,
    title: "Medicine Reminders",
    description: "Never miss a dose with voice and visual reminders for all your medications.",
  },
];

export default function Landing() {
  const [showMenu, setShowMenu] = useState(false);

  return (
    <div className="min-h-screen bg-background">
      <Header onMenuToggle={() => setShowMenu(!showMenu)} showMenu={showMenu} />

      {/* Hero Section */}
      <section className="container py-16 md:py-24">
        <div className="mx-auto max-w-4xl text-center">
          {/* Icon */}
          <div className="mx-auto mb-6 flex h-16 w-16 items-center justify-center rounded-2xl bg-primary/10">
            <Stethoscope className="h-8 w-8 text-primary" />
          </div>

          {/* Headline */}
          <h1 className="mb-6 text-4xl md:text-5xl lg:text-6xl font-bold tracking-tight">
            Transform Healthcare with{" "}
            <span className="text-primary">AI Voice Agents</span>
          </h1>

          {/* Subheadline */}
          <p className="mb-8 text-lg md:text-xl text-muted-foreground max-w-2xl mx-auto">
            Provide 24/7 intelligent medical support using conversational AI. 
            Speak your symptoms, get instant guidance, and stay connected with your health.
          </p>

          {/* CTA Buttons */}
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Button asChild size="lg" className="text-lg px-8 h-14">
              <Link to="/dashboard">
                Get Started
                <ArrowRight className="ml-2 h-5 w-5" />
              </Link>
            </Button>
            <Button asChild variant="outline" size="lg" className="text-lg px-8 h-14">
              <Link to="/consultation/general-physician">
                <MessageSquare className="mr-2 h-5 w-5" />
                Try a Consultation
              </Link>
            </Button>
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section className="container py-16 border-t border-border">
        <h2 className="text-center text-3xl font-bold mb-12">Everything You Need</h2>
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
          {features.map((feature, index) => (
            <Card key={index} className="border shadow-sm hover:shadow-md transition-shadow">
              <CardContent className="pt-6">
                <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-xl bg-primary/10 text-primary">
                  {feature.icon}
                </div>
                <h3 className="mb-2 text-lg font-semibold">{feature.title}</h3>
                <p className="text-sm text-muted-foreground">{feature.description}</p>
              </CardContent>
            </Card>
          ))}
        </div>
      </section>

      {/* How It Works */}
      <section className="container py-16 border-t border-border">
        <h2 className="mb-12 text-center text-3xl font-bold">How It Works</h2>
        <div className="grid gap-8 md:grid-cols-3 max-w-4xl mx-auto">
          {[
            { step: "1", title: "Choose a Specialist", desc: "Select from 25+ AI doctors across all medical fields" },
            { step: "2", title: "Speak Your Concern", desc: "Use your voice to describe symptoms naturally" },
            { step: "3", title: "Get Instant Guidance", desc: "Receive clear, jargon-free medical advice" },
          ].map((item, index) => (
            <div key={index} className="text-center">
              <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-primary text-primary-foreground text-xl font-bold">
                {item.step}
              </div>
              <h3 className="mb-2 text-lg font-semibold">{item.title}</h3>
              <p className="text-muted-foreground">{item.desc}</p>
            </div>
          ))}
        </div>

        {/* CTA */}
        <div className="text-center mt-12">
          <Button asChild size="lg" className="text-lg px-8 h-14">
            <Link to="/dashboard">
              Start Your First Consultation
              <ArrowRight className="ml-2 h-5 w-5" />
            </Link>
          </Button>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-border py-8 mt-8">
        <div className="container text-center text-sm text-muted-foreground">
          <p className="mb-2">© 2026 VoiceAid. For informational purposes only.</p>
          <p>Always consult a real doctor for medical advice.</p>
        </div>
      </footer>
    </div>
  );
}
