import { useState, useEffect } from "react";
import { useNavigate, Link } from "react-router-dom";
import { Header } from "@/components/layout/Header";
import { SOSButton } from "@/components/layout/SOSButton";
import { SpecialistCard } from "@/components/specialists/SpecialistCard";
import { SPECIALISTS, SPECIALIST_CATEGORIES, Specialist } from "@/types/specialists";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Search, Clock, ChevronRight, Mic, Sparkles, MessageCircle } from "lucide-react";
import { toast } from "@/hooks/use-toast";
import { getConsultationHistory, ConsultationRecord } from "@/pages/History";
import { motion, AnimatePresence } from "framer-motion";
import { VoiceTriage } from "@/components/voice/VoiceTriage";
import { QuickActions } from "@/components/dashboard/QuickActions";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { Pill, Phone, Activity } from "lucide-react";
export default function Dashboard() {
  const navigate = useNavigate();
  const [showMenu, setShowMenu] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [recentConsultations, setRecentConsultations] = useState<ConsultationRecord[]>([]);
  const [showVoiceTriage, setShowVoiceTriage] = useState(false);
  const [managedElders, setManagedElders] = useState<any[]>([]);
  const [isEldersLoading, setIsEldersLoading] = useState(false);
  const { profile } = useAuth();

  // Load real consultation history and managed elders
  useEffect(() => {
    setRecentConsultations(getConsultationHistory().slice(0, 3));
    
    if (profile?.role === "caregiver") {
      fetchManagedElders();
    }
  }, [profile]);

  const fetchManagedElders = async () => {
    if (!profile) return;
    setIsEldersLoading(true);
    try {
      const { data: connections } = await supabase
        .from("family_connections")
        .select(`
          elder_id,
          profiles!family_connections_elder_id_fkey (
            id,
            full_name,
            phone
          )
        `)
        .eq("caregiver_id", profile.id);

      if (connections) {
        const elders = connections.map((c: any) => c.profiles).filter(Boolean);
        setManagedElders(elders);
      }
    } catch (err) {
      console.error("Error fetching managed elders:", err);
    } finally {
      setIsEldersLoading(false);
    }
  };

  const handleSpecialistClick = (specialist: Specialist) => {
    navigate(`/consultation/${specialist.id}`);
  };

  const handleSOS = () => {
    toast({
      title: "🚨 Emergency Mode",
      description: "SOS feature will be activated. This will call your emergency contacts.",
      variant: "destructive",
    });
  };

  // Filter specialists
  const filteredSpecialists = SPECIALISTS.filter((specialist) => {
    const matchesSearch = 
      searchQuery === "" ||
      specialist.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      specialist.description.toLowerCase().includes(searchQuery.toLowerCase()) ||
      specialist.name.toLowerCase().includes(searchQuery.toLowerCase());
    
    const matchesCategory = 
      selectedCategory === null || 
      specialist.category === selectedCategory;

    return matchesSearch && matchesCategory;
  });

  // Group by category for display
  const specialistsByCategory = SPECIALIST_CATEGORIES
    .map((category) => ({
      category,
      specialists: filteredSpecialists.filter((s) => s.category === category.id),
    }))
    .filter(({ specialists }) => specialists.length > 0);

  return (
    <div className="min-h-screen bg-background">
      <Header onMenuToggle={() => setShowMenu(!showMenu)} showMenu={showMenu} />

      <main className="container py-6 pb-32">
        {/* Voice Triage Modal */}
        <AnimatePresence>
          {showVoiceTriage && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 z-50 bg-background/80 backdrop-blur-sm flex items-center justify-center p-4"
            >
              <motion.div
                initial={{ scale: 0.95, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                exit={{ scale: 0.95, opacity: 0 }}
                className="w-full max-w-lg"
              >
                <VoiceTriage onClose={() => setShowVoiceTriage(false)} />
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Hero Voice-First Section */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="mb-8"
        >
          <Card className="bg-gradient-to-br from-primary/10 via-primary/5 to-transparent border-primary/20 overflow-hidden">
            <CardContent className="p-6 md:p-8">
              <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-6">
                {/* Greeting */}
                <div>
                  <div className="flex items-center gap-2 mb-2">
                    <Sparkles className="h-5 w-5 text-primary" />
                    <span className="text-sm text-primary font-medium">Voice-First Health Companion</span>
                  </div>
                  <h1 className="text-3xl md:text-4xl font-bold">Hello there! 👋</h1>
                  <p className="mt-2 text-lg text-muted-foreground">
                    Just tell me what's wrong, and I'll connect you to the right specialist.
                  </p>
                </div>

                {/* Voice-First Actions */}
                <div className="flex gap-3">
                  <Button
                    size="lg"
                    onClick={() => setShowVoiceTriage(true)}
                    className="h-16 px-6 text-lg gap-3 shadow-lg hover:shadow-xl transition-shadow"
                  >
                    <Mic className="h-6 w-6" />
                    <span className="hidden sm:inline">Just Speak</span>
                    <span className="sm:hidden">Speak</span>
                  </Button>
                  <Button
                    variant="outline"
                    size="lg"
                    className="h-16 px-6 text-lg gap-3"
                    onClick={() => document.getElementById('specialists-section')?.scrollIntoView({ behavior: 'smooth' })}
                  >
                    <MessageCircle className="h-6 w-6" />
                    <span className="hidden sm:inline">Choose Specialist</span>
                    <span className="sm:hidden">Choose</span>
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        </motion.div>

        {/* Quick Actions Section */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="mb-10"
        >
          <QuickActions 
            onActionClick={(id) => {
              if (id === "profile") navigate("/caregiver");
              else if (id === "contacts") navigate("/onboarding");
              else navigate(`/${id}`);
            }} 
          />
        </motion.div>

        {/* Managed Elders Section for Caregivers */}
        {profile?.role === "caregiver" && managedElders.length > 0 && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.15 }}
            className="mb-10"
          >
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-xl font-bold flex items-center gap-2">
                <Activity className="h-5 w-5 text-primary" />
                Managed Elders
              </h2>
              <Button variant="ghost" size="sm" asChild>
                <Link to="/caregiver" className="flex items-center gap-1">
                  View Portal <ChevronRight className="h-4 w-4" />
                </Link>
              </Button>
            </div>
            
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {managedElders.map((elder) => (
                <Card key={elder.id} className="hover:border-primary/50 transition-colors cursor-pointer" onClick={() => navigate("/caregiver")}>
                  <CardContent className="p-5">
                    <div className="flex items-center gap-3 mb-4">
                      <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center text-xl">
                        👴
                      </div>
                      <div>
                        <p className="font-bold">{elder.full_name}</p>
                        <p className="text-xs text-muted-foreground">{elder.phone || "No phone"}</p>
                      </div>
                    </div>
                    <div className="flex justify-between items-center text-xs mt-auto pt-2 border-t">
                      <span className="text-muted-foreground flex items-center gap-1">
                        <Activity className="h-3 w-3" /> Health Status
                      </span>
                      <ChevronRight className="h-4 w-4 text-primary" />
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </motion.div>
        )}

        <div className="grid gap-6 lg:grid-cols-[1fr_320px]">
          {/* Left Column - Specialists */}
          <div className="space-y-6" id="specialists-section">
            {/* Search */}
            <motion.div 
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.1 }}
              className="relative"
            >
              <Search className="absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder="Search specialists..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-12 h-14 text-lg rounded-full border-2 focus:border-primary"
              />
            </motion.div>

            {/* Category Filter */}
            <motion.div 
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.15 }}
              className="flex gap-2 flex-wrap"
            >
              <Button
                variant={selectedCategory === null ? "default" : "outline"}
                size="lg"
                onClick={() => setSelectedCategory(null)}
                className="rounded-full"
              >
                All Specialists
              </Button>
              {SPECIALIST_CATEGORIES.map((category) => (
                <Button
                  key={category.id}
                  variant={selectedCategory === category.id ? "default" : "outline"}
                  size="lg"
                  onClick={() => setSelectedCategory(category.id)}
                  className="rounded-full"
                >
                  <span className="mr-2">{category.emoji}</span>
                  {category.name}
                </Button>
              ))}
            </motion.div>

            {/* Specialists Section */}
            <div>
              <motion.h2 
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.2 }}
                className="text-xl font-semibold mb-4 flex items-center gap-2"
              >
                <Mic className="h-5 w-5 text-primary" />
                AI Health Specialists
                <span className="text-sm font-normal text-muted-foreground">({filteredSpecialists.length})</span>
              </motion.h2>
              
              <AnimatePresence mode="wait">
                {selectedCategory === null ? (
                  // Show grouped by category
                  <motion.div 
                    key="grouped"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    className="space-y-8"
                  >
                    {specialistsByCategory.map(({ category, specialists }, categoryIndex) => (
                      <motion.div 
                        key={category.id}
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: categoryIndex * 0.1 }}
                      >
                        <h3 className="text-lg font-medium text-muted-foreground mb-3 flex items-center gap-2">
                          <span className="text-2xl">{category.emoji}</span>
                          {category.name}
                        </h3>
                        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                          {specialists.map((specialist, index) => (
                            <motion.div
                              key={specialist.id}
                              initial={{ opacity: 0, scale: 0.95 }}
                              animate={{ opacity: 1, scale: 1 }}
                              transition={{ delay: index * 0.05 }}
                            >
                              <SpecialistCard
                                specialist={specialist}
                                onClick={() => handleSpecialistClick(specialist)}
                              />
                            </motion.div>
                          ))}
                        </div>
                      </motion.div>
                    ))}
                  </motion.div>
                ) : (
                  // Show filtered list
                  <motion.div 
                    key="filtered"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3"
                  >
                    {filteredSpecialists.map((specialist, index) => (
                      <motion.div
                        key={specialist.id}
                        initial={{ opacity: 0, scale: 0.95 }}
                        animate={{ opacity: 1, scale: 1 }}
                        transition={{ delay: index * 0.05 }}
                      >
                        <SpecialistCard
                          specialist={specialist}
                          onClick={() => handleSpecialistClick(specialist)}
                        />
                      </motion.div>
                    ))}
                  </motion.div>
                )}
              </AnimatePresence>

              {filteredSpecialists.length === 0 && (
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  className="text-center py-12"
                >
                  <p className="text-muted-foreground">No specialists found matching your search.</p>
                  <Button 
                    variant="link" 
                    onClick={() => { setSearchQuery(""); setSelectedCategory(null); }}
                  >
                    Clear filters
                  </Button>
                </motion.div>
              )}
            </div>
          </div>

          {/* Right Column - History */}
          <motion.div 
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.3 }}
            className="space-y-6"
          >
            <Card className="border-2">
              <CardHeader className="pb-3">
                <CardTitle className="text-lg flex items-center justify-between">
                  <span className="flex items-center gap-2">
                    <Clock className="h-5 w-5 text-primary" />
                    Recent Conversations
                  </span>
                  {recentConsultations.length > 0 && (
                    <Button variant="ghost" size="sm" className="text-primary" asChild>
                      <Link to="/history">
                        View All
                        <ChevronRight className="h-4 w-4 ml-1" />
                      </Link>
                    </Button>
                  )}
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {recentConsultations.length > 0 ? (
                  recentConsultations.map((consultation) => (
                    <motion.div
                      key={consultation.id}
                      whileHover={{ scale: 1.02 }}
                      whileTap={{ scale: 0.98 }}
                      className="flex items-center gap-3 p-3 rounded-xl bg-muted/50 hover:bg-muted cursor-pointer transition-colors"
                      onClick={() => navigate(`/consultation/${consultation.specialistId}`)}
                    >
                      <div className="text-2xl">{consultation.emoji}</div>
                      <div className="flex-1 min-w-0">
                        <p className="font-medium text-sm truncate">{consultation.specialistName}</p>
                        <p className="text-xs text-muted-foreground truncate">{consultation.summary}</p>
                      </div>
                      <ChevronRight className="h-4 w-4 text-muted-foreground" />
                    </motion.div>
                  ))
                ) : (
                  <div className="text-center py-6">
                    <Clock className="h-10 w-10 mx-auto text-muted-foreground/50 mb-2" />
                    <p className="text-sm text-muted-foreground">
                      No conversations yet
                    </p>
                    <p className="text-xs text-muted-foreground mt-1">
                      Start chatting with a specialist!
                    </p>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Voice Triage Quick Card */}
            <Card className="bg-gradient-to-br from-primary/10 to-primary/5 border-primary/20">
              <CardContent className="p-4">
                <div className="flex items-start gap-3">
                  <div className="p-2 rounded-full bg-primary/10">
                    <Mic className="h-5 w-5 text-primary" />
                  </div>
                  <div className="flex-1">
                    <h4 className="font-medium text-sm">Don't know which specialist?</h4>
                    <p className="text-xs text-muted-foreground mt-1">
                      Just tap "Speak" and describe your symptoms. Our AI will automatically connect you to the right doctor.
                    </p>
                    <Button 
                      size="sm" 
                      variant="link" 
                      className="px-0 mt-1 text-primary"
                      onClick={() => setShowVoiceTriage(true)}
                    >
                      Try it now →
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          </motion.div>
        </div>
      </main>

      <SOSButton onClick={handleSOS} />
    </div>
  );
}
