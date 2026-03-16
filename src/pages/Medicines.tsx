import { useState, useEffect } from "react";
import { Header } from "@/components/layout/Header";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Pill, Check, X, Clock, Plus, Loader2, Trash2, Calendar } from "lucide-react";
import { toast } from "@/hooks/use-toast";
import { motion, AnimatePresence } from "framer-motion";
import { cn } from "@/lib/utils";
import { format } from "date-fns";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

interface Medicine {
  id: string;
  name: string;
  dosage: string;
  frequency: string;
  times: string[];
  instructions: string | null;
  is_active: boolean;
}

interface MedicineLog {
  id: string;
  medicine_id: string;
  scheduled_time: string;
  status: string;
  taken_at: string | null;
}

export default function Medicines() {
  const navigate = useNavigate();
  const { user, profile, isLoading: authLoading } = useAuth();
  const [showMenu, setShowMenu] = useState(false);
  const [medicines, setMedicines] = useState<Medicine[]>([]);
  const [logs, setLogs] = useState<MedicineLog[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isAdding, setIsAdding] = useState(false);
  
  // New medicine form state
  const [newName, setNewName] = useState("");
  const [newDosage, setNewDosage] = useState("");
  const [newTime, setNewTime] = useState("09:00");
  const [newInstructions, setNewInstructions] = useState("");

  const today = format(new Date(), "yyyy-MM-dd");

  const fetchData = async () => {
    if (!profile) {
      setIsLoading(false);
      return;
    }
    
    setIsLoading(true);
    try {
      console.log("Medicines: Fetching data for profile", profile.id);
      const { data: meds, error: medsErr } = await supabase
        .from("medicines")
        .select("*")
        .eq("elder_id", profile.id)
        .eq("is_active", true);

      if (medsErr) throw medsErr;
      setMedicines((meds as Medicine[]) || []);

      const { data: todayLogs, error: logsErr } = await supabase
        .from("medicine_logs")
        .select("*")
        .gte("scheduled_time", `${today}T00:00:00`)
        .lte("scheduled_time", `${today}T23:59:59`);

      if (logsErr) throw logsErr;
      
      // Filter logs for our medicines only
      const medIds = meds?.map(m => m.id) || [];
      setLogs((todayLogs as MedicineLog[]).filter(l => medIds.includes(l.medicine_id)) || []);
    } catch (error: any) {
      console.error("Medicines: Error fetching data:", error);
      toast({
        title: "Error loading medicines",
        description: error.message || "Please check your connection.",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (!authLoading) {
      fetchData();
    }
  }, [profile, authLoading]);

  const handleAddMedicine = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!profile || !newName || !newDosage) return;

    try {
      const { error } = await supabase.from("medicines").insert({
        elder_id: profile.id,
        name: newName,
        dosage: newDosage,
        frequency: "daily",
        times: [newTime],
        instructions: newInstructions,
        is_active: true,
      });

      if (error) throw error;

      toast({ title: "Success!", description: "Medicine added to your list." });
      setNewName("");
      setNewDosage("");
      setNewInstructions("");
      setIsAdding(false);
      fetchData();
    } catch (error: any) {
      toast({
        title: "Failed to add medicine",
        description: error.message,
        variant: "destructive",
      });
    }
  };

  const handleDeleteMedicine = async (id: string) => {
    try {
      const { error } = await supabase
        .from("medicines")
        .update({ is_active: false })
        .eq("id", id);

      if (error) throw error;

      toast({ title: "Removed", description: "Medicine removed from tracking." });
      fetchData();
    } catch (error: any) {
      toast({
        title: "Error removing medicine",
        description: error.message,
        variant: "destructive",
      });
    }
  };

  const handleTakeMedicine = async (medicine: Medicine, time: string) => {
    const scheduledTime = `${today}T${time}:00`;
    const existing = logs.find(
      (l) => l.medicine_id === medicine.id && l.scheduled_time.includes(time)
    );

    try {
      if (existing) {
        await supabase
          .from("medicine_logs")
          .update({ status: "taken", taken_at: new Date().toISOString() })
          .eq("id", existing.id);
      } else {
        await supabase.from("medicine_logs").insert({
          medicine_id: medicine.id,
          scheduled_time: scheduledTime,
          status: "taken",
          taken_at: new Date().toISOString(),
        });
      }
      toast({ title: "✅ Medicine taken!", description: `${medicine.name} marked as taken.` });
      fetchData();
    } catch (err) {
      console.error("Error logging medicine:", err);
    }
  };

  const handleSkipMedicine = async (medicine: Medicine, time: string) => {
    const scheduledTime = `${today}T${time}:00`;
    const existing = logs.find(
      (l) => l.medicine_id === medicine.id && l.scheduled_time.includes(time)
    );

    try {
      if (existing) {
        await supabase
          .from("medicine_logs")
          .update({ status: "skipped" })
          .eq("id", existing.id);
      } else {
        await supabase.from("medicine_logs").insert({
          medicine_id: medicine.id,
          scheduled_time: scheduledTime,
          status: "skipped",
        });
      }
      toast({ title: "Skipped", description: `${medicine.name} skipped for ${time}.` });
      fetchData();
    } catch (err) {
      console.error("Error skipping medicine:", err);
    }
  };

  const getLogStatus = (medicineId: string, time: string) => {
    const log = logs.find(
      (l) => l.medicine_id === medicineId && l.scheduled_time.includes(time)
    );
    return log?.status || "pending";
  };

  const schedule = medicines
    .flatMap((med) =>
      med.times.map((time) => ({
        medicine: med,
        time,
        status: getLogStatus(med.id, time),
      }))
    )
    .sort((a, b) => a.time.localeCompare(b.time));

  const takenCount = schedule.filter((s) => s.status === "taken").length;
  const totalCount = schedule.length;
  const adherencePercent = totalCount > 0 ? Math.round((takenCount / totalCount) * 100) : 0;

  // Main UI States
  if (authLoading) {
    return (
      <div className="min-h-screen bg-background">
        <Header onMenuToggle={() => setShowMenu(!showMenu)} showMenu={showMenu} />
        <main className="container py-12 text-center">
          <Loader2 className="h-12 w-12 animate-spin mx-auto text-primary mb-4" />
          <p className="text-muted-foreground">Checking authentication...</p>
        </main>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="min-h-screen bg-background">
        <Header onMenuToggle={() => setShowMenu(!showMenu)} showMenu={showMenu} />
        <main className="container py-12 text-center">
          <div className="max-w-md mx-auto p-6 border rounded-2xl bg-muted/30">
            <Pill className="h-16 w-16 mx-auto text-muted-foreground/50 mb-4" />
            <h2 className="text-xl font-semibold mb-2">Sign in to view medicines</h2>
            <p className="text-muted-foreground mb-6">Please sign in to access your health trackers.</p>
            <Button onClick={() => navigate("/auth")} className="w-full">Sign In</Button>
          </div>
        </main>
      </div>
    );
  }

  if (!profile || profile.role === "caregiver") {
    return (
      <div className="min-h-screen bg-background">
        <Header onMenuToggle={() => setShowMenu(!showMenu)} showMenu={showMenu} />
        <main className="container py-12 text-center">
          <div className="max-w-md mx-auto p-6 border rounded-2xl bg-muted/30">
            <Calendar className="h-16 w-16 mx-auto text-muted-foreground/50 mb-4" />
            <h2 className="text-xl font-semibold mb-2">Setup Required</h2>
            <p className="text-muted-foreground mb-6">
              {!profile 
                ? "We couldn't load your profile. You might need to complete the setup process." 
                : "You are logged in as a caregiver. Connect an elder profile to start tracking medicines."}
            </p>
            <Button onClick={() => navigate("/onboarding")} className="w-full">
               Complete Setup
            </Button>
            {!profile && (
              <Button variant="ghost" onClick={() => window.location.reload()} className="w-full mt-2 text-xs">
                Retry Connection
              </Button>
            )}
          </div>
        </main>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <Header onMenuToggle={() => setShowMenu(!showMenu)} showMenu={showMenu} />

      <main className="container py-6 max-w-3xl">
        <div className="flex items-center justify-between mb-6">
          <motion.div initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }}>
            <h1 className="text-2xl font-bold flex items-center gap-2">
              <Pill className="h-6 w-6 text-primary" />
              Medicine Tracker
            </h1>
            <p className="text-sm text-muted-foreground">
              Managing for {profile.full_name}
            </p>
          </motion.div>
          
          <Button onClick={() => setIsAdding(!isAdding)} variant={isAdding ? "outline" : "default"}>
            {isAdding ? "Cancel" : <><Plus className="h-4 w-4 mr-2" /> Add New</>}
          </Button>
        </div>

        <AnimatePresence>
          {isAdding && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: "auto", opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              className="overflow-hidden mb-8"
            >
              <Card className="border-2 border-primary/20">
                <CardHeader>
                  <CardTitle>Add New Medicine</CardTitle>
                  <CardDescription>Schedule a new prescription or supplement</CardDescription>
                </CardHeader>
                <CardContent>
                  <form onSubmit={handleAddMedicine} className="space-y-4">
                    <div className="grid gap-4 sm:grid-cols-2">
                      <div className="space-y-2">
                        <label className="text-sm font-medium">Medicine Name</label>
                        <Input 
                          placeholder="e.g., Metformin" 
                          value={newName}
                          onChange={(e) => setNewName(e.target.value)}
                          required
                        />
                      </div>
                      <div className="space-y-2">
                        <label className="text-sm font-medium">Dosage</label>
                        <Input 
                          placeholder="e.g., 500mg" 
                          value={newDosage}
                          onChange={(e) => setNewDosage(e.target.value)}
                          required
                        />
                      </div>
                    </div>
                    <div className="grid gap-4 sm:grid-cols-2">
                      <div className="space-y-2">
                        <label className="text-sm font-medium">Time</label>
                        <Input 
                          type="time" 
                          value={newTime}
                          onChange={(e) => setNewTime(e.target.value)}
                          required
                        />
                      </div>
                      <div className="space-y-2">
                        <label className="text-sm font-medium">Instructions (Optional)</label>
                        <Input 
                          placeholder="e.g., Take after meal" 
                          value={newInstructions}
                          onChange={(e) => setNewInstructions(e.target.value)}
                        />
                      </div>
                    </div>
                    <Button type="submit" className="w-full shadow-lg">Save Medicine</Button>
                  </form>
                </CardContent>
              </Card>
            </motion.div>
          )}
        </AnimatePresence>

        <Tabs defaultValue="schedule" className="space-y-6">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="schedule">Daily Schedule</TabsTrigger>
            <TabsTrigger value="manage">Manage List</TabsTrigger>
          </TabsList>

          <TabsContent value="schedule" className="space-y-6">
            <Card className="bg-gradient-to-br from-primary/10 via-primary/5 to-transparent border-primary/20">
              <CardContent className="p-5">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-muted-foreground">Today's Progress</p>
                    <p className="text-3xl font-bold text-primary">{adherencePercent}%</p>
                    <p className="text-sm text-muted-foreground">{takenCount} of {totalCount} completed</p>
                  </div>
                  <div className="h-16 w-16 rounded-full border-4 border-primary/20 flex items-center justify-center">
                    <span className="text-2xl">{adherencePercent === 100 ? "🎉" : adherencePercent >= 50 ? "💊" : "⏰"}</span>
                  </div>
                </div>
                <div className="mt-3 h-2 bg-muted rounded-full overflow-hidden">
                  <motion.div
                    className="h-full bg-primary rounded-full"
                    initial={{ width: 0 }}
                    animate={{ width: `${adherencePercent}%` }}
                    transition={{ duration: 0.8 }}
                  />
                </div>
              </CardContent>
            </Card>

            {isLoading ? (
              <div className="text-center py-12">
                <Loader2 className="h-8 w-8 animate-spin mx-auto text-primary" />
                <p className="text-muted-foreground mt-2">Loading schedule...</p>
              </div>
            ) : schedule.length === 0 ? (
              <div className="text-center py-12 bg-muted/30 rounded-2xl border-2 border-dashed">
                <Calendar className="h-12 w-12 mx-auto text-muted-foreground/50 mb-3" />
                <h3 className="font-semibold text-lg">No Schedule Today</h3>
                <p className="text-muted-foreground max-w-xs mx-auto">Add medicines to your list to start tracking them here.</p>
              </div>
            ) : (
              <div className="space-y-3">
                {schedule.map((item, index) => (
                  <motion.div
                    key={`${item.medicine.id}-${item.time}`}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: index * 0.05 }}
                  >
                    <Card className={cn(
                      "transition-all",
                      item.status === "taken" && "border-green-500/30 bg-green-500/5",
                      item.status === "skipped" && "border-muted opacity-60"
                    )}>
                      <CardContent className="p-4 flex items-center gap-4">
                        <div className="text-center min-w-[60px]">
                          <p className="text-lg font-bold text-primary">{item.time}</p>
                        </div>
                        <div className="flex-1">
                          <p className="font-semibold">{item.medicine.name}</p>
                          <p className="text-xs text-muted-foreground">{item.medicine.dosage}</p>
                        </div>
                        {item.status === "pending" ? (
                          <div className="flex gap-2">
                            <Button size="icon" className="h-9 w-9 bg-green-600 hover:bg-green-700 rounded-full" onClick={() => handleTakeMedicine(item.medicine, item.time)}>
                              <Check className="h-4 w-4" />
                            </Button>
                            <Button size="icon" variant="outline" className="h-9 w-9 rounded-full" onClick={() => handleSkipMedicine(item.medicine, item.time)}>
                              <X className="h-4 w-4" />
                            </Button>
                          </div>
                        ) : (
                          <Badge variant={item.status === "taken" ? "default" : "secondary"}>
                            {item.status === "taken" ? "Taken" : "Skipped"}
                          </Badge>
                        )}
                      </CardContent>
                    </Card>
                  </motion.div>
                ))}
              </div>
            )}
          </TabsContent>

          <TabsContent value="manage" className="space-y-4">
            {medicines.length === 0 ? (
              <div className="text-center py-12 bg-muted/30 rounded-2xl border-2 border-dashed">
                <Pill className="h-12 w-12 mx-auto text-muted-foreground/50 mb-3" />
                <h3 className="font-semibold text-lg">Empty List</h3>
                <p className="text-muted-foreground">Start adding medicines using the button above.</p>
              </div>
            ) : (
              <div className="grid gap-4">
                {medicines.map((med) => (
                  <Card key={med.id}>
                    <CardContent className="p-4 flex items-center justify-between">
                      <div className="flex items-center gap-4">
                        <div className="h-12 w-12 rounded-xl bg-primary/10 flex items-center justify-center text-primary">
                          <Pill className="h-6 w-6" />
                        </div>
                        <div>
                          <p className="font-bold">{med.name}</p>
                          <p className="text-sm text-muted-foreground">{med.dosage} • {med.times.join(", ")}</p>
                        </div>
                      </div>
                      <Button 
                        variant="ghost" 
                        size="icon" 
                        className="text-destructive hover:bg-destructive/10"
                        onClick={() => handleDeleteMedicine(med.id)}
                      >
                        <Trash2 className="h-5 w-5" />
                      </Button>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </TabsContent>
        </Tabs>
      </main>
    </div>
  );
}
