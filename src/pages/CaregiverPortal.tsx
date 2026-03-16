import { useState, useEffect } from "react";
import { Header } from "@/components/layout/Header";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Users, Pill, Phone, Loader2 } from "lucide-react";
import { Link } from "react-router-dom";
import { motion } from "framer-motion";
import { format } from "date-fns";

interface ElderProfile {
  id: string;
  full_name: string;
  phone: string | null;
}

interface MedicineSummary {
  total: number;
  takenToday: number;
}

export default function CaregiverPortal() {
  const { user, profile } = useAuth();
  const [showMenu, setShowMenu] = useState(false);
  const [elders, setElders] = useState<ElderProfile[]>([]);
  const [elderMedicines, setElderMedicines] = useState<Record<string, MedicineSummary>>({});
  const [elderContacts, setElderContacts] = useState<Record<string, number>>({});
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (profile && profile.role === "caregiver") {
      fetchElders();
    } else if (!authLoading) {
      setIsLoading(false);
    }
  }, [profile]);

  // Add authLoading from hook if needed, but it's already in useAuth
  const { isLoading: authLoading } = useAuth();

  const fetchElders = async () => {
    if (!profile) return;
    setIsLoading(true);

    try {
      // Get family connections
      const { data: connections } = await supabase
        .from("family_connections")
        .select("elder_id")
        .eq("caregiver_id", profile.id);

      if (!connections || connections.length === 0) {
        setIsLoading(false);
        return;
      }

      const elderIds = connections.map((c) => c.elder_id);

      // Fetch elder profiles
      const { data: elderProfiles } = await supabase
        .from("profiles")
        .select("id, full_name, phone")
        .in("id", elderIds);

      setElders((elderProfiles as ElderProfile[]) || []);

      const medsMap: Record<string, MedicineSummary> = {};
      const contactsMap: Record<string, number> = {};

      for (const elderId of elderIds) {
        // Medicines count
        const { data: meds } = await supabase
          .from("medicines")
          .select("id")
          .eq("elder_id", elderId)
          .eq("is_active", true);

        const today = format(new Date(), "yyyy-MM-dd");
        const { data: todayLogs } = await supabase
          .from("medicine_logs")
          .select("id, status")
          .gte("scheduled_time", `${today}T00:00:00`)
          .lte("scheduled_time", `${today}T23:59:59`);

        medsMap[elderId] = {
          total: meds?.length || 0,
          takenToday: todayLogs?.filter((l) => l.status === "taken").length || 0,
        };

        // Emergency contacts count
        const { data: contacts } = await supabase
          .from("emergency_contacts")
          .select("id")
          .eq("elder_id", elderId);

        contactsMap[elderId] = contacts?.length || 0;
      }

      setElderMedicines(medsMap);
      setElderContacts(contactsMap);
    } catch (error) {
      console.error("CaregiverPortal: Error fetching data:", error);
    } finally {
      setIsLoading(false);
    }
  };

  if (authLoading || (isLoading && elders.length === 0)) {
    return (
      <div className="min-h-screen bg-background">
        <Header onMenuToggle={() => setShowMenu(!showMenu)} showMenu={showMenu} />
        <main className="container py-12 text-center">
          <Loader2 className="h-12 w-12 animate-spin mx-auto text-primary mb-4" />
          <p className="text-muted-foreground">Loading portal...</p>
        </main>
      </div>
    );
  }

  if (!user || !profile) {
    return (
      <div className="min-h-screen bg-background">
        <Header onMenuToggle={() => setShowMenu(!showMenu)} showMenu={showMenu} />
        <main className="container py-12 text-center">
          <Users className="h-16 w-16 mx-auto text-muted-foreground/50 mb-4" />
          <h2 className="text-xl font-semibold mb-2">Sign in to access the portal</h2>
        </main>
      </div>
    );
  }

  if (profile.role !== "caregiver") {
    return (
      <div className="min-h-screen bg-background">
        <Header onMenuToggle={() => setShowMenu(!showMenu)} showMenu={showMenu} />
        <main className="container py-12 text-center">
          <Users className="h-16 w-16 mx-auto text-muted-foreground/50 mb-4" />
          <h2 className="text-xl font-semibold mb-2">Caregiver Access Only</h2>
          <p className="text-muted-foreground">This portal is for caregivers to monitor their elders.</p>
        </main>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <Header onMenuToggle={() => setShowMenu(!showMenu)} showMenu={showMenu} />

      <main className="container py-6 max-w-3xl">
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
          <h1 className="text-2xl font-bold flex items-center gap-2 mb-2">
            <Users className="h-6 w-6 text-primary" />
            Caregiver Portal
          </h1>
          <p className="text-muted-foreground mb-6">Monitor your elders' health and wellbeing</p>
        </motion.div>

        {elders.length === 0 ? (
          <Card>
            <CardContent className="p-8 text-center">
              <Users className="h-12 w-12 mx-auto text-muted-foreground/50 mb-3" />
              <h3 className="font-semibold text-lg mb-1">No Elders Connected</h3>
              <p className="text-muted-foreground text-sm mb-4">
                Complete the onboarding to add an elder's profile.
              </p>
              <Button asChild>
                <Link to="/onboarding">Set Up Elder Profile</Link>
              </Button>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-6">
            {elders.map((elder, index) => (
              <motion.div
                key={elder.id}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: index * 0.1 }}
              >
                <Card className="border-2">
                  <CardHeader className="pb-3">
                    <CardTitle className="flex items-center justify-between">
                      <span className="flex items-center gap-2">
                        <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center text-lg">
                          👴
                        </div>
                        {elder.full_name}
                      </span>
                      {elder.phone && (
                        <Badge variant="outline" className="text-xs">{elder.phone}</Badge>
                      )}
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="grid gap-4 sm:grid-cols-2">
                      {/* Medicines */}
                      <Card className="bg-muted/30">
                        <CardContent className="p-4">
                          <div className="flex items-center gap-2 mb-2">
                            <Pill className="h-4 w-4 text-primary" />
                            <span className="text-sm font-medium">Medicines</span>
                          </div>
                          <p className="text-2xl font-bold">{elderMedicines[elder.id]?.total || 0}</p>
                          <p className="text-xs text-muted-foreground">
                            {elderMedicines[elder.id]?.takenToday || 0} taken today
                          </p>
                        </CardContent>
                      </Card>

                      {/* Emergency Contacts */}
                      <Card className="bg-muted/30">
                        <CardContent className="p-4">
                          <div className="flex items-center gap-2 mb-2">
                            <Phone className="h-4 w-4 text-primary" />
                            <span className="text-sm font-medium">Contacts</span>
                          </div>
                          <p className="text-2xl font-bold">{elderContacts[elder.id] || 0}</p>
                          <p className="text-xs text-muted-foreground">emergency contacts</p>
                        </CardContent>
                      </Card>
                    </div>
                  </CardContent>
                </Card>
              </motion.div>
            ))}
          </div>
        )}
      </main>
    </div>
  );
}
