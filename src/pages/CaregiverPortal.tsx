import { useState, useEffect } from "react";
import { Pill, Phone, Trash2, AlertTriangle, Users, Loader2 } from "lucide-react";
import { Link } from "react-router-dom";
import { motion } from "framer-motion";
import { Header } from "@/components/layout/Header";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { format } from "date-fns";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

interface ElderProfile {
  id: string;
  full_name: string;
  phone: string | null;
  medicines?: { name: string; dosage: string }[];
  emergency_contacts?: { name: string; phone: string; relationship: string }[];
}

interface MedicineSummary {
  total: number;
  takenToday: number;
}

export default function CaregiverPortal() {
  const { user, profile, isLoading: authLoading } = useAuth();
  const [showMenu, setShowMenu] = useState(false);
  const [elders, setElders] = useState<ElderProfile[]>([]);
  const [elderMedicines, setElderMedicines] = useState<Record<string, MedicineSummary>>({});
  const [elderContacts, setElderContacts] = useState<Record<string, number>>({});
  const [isLoading, setIsLoading] = useState(true);
  const [profileToDelete, setProfileToDelete] = useState<string | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [isAddingElder, setIsAddingElder] = useState(false);
  const [newElderName, setNewElderName] = useState("");
  const [newElderPhone, setNewElderPhone] = useState("");
  const [isSwitchingRole, setIsSwitchingRole] = useState(false);

  useEffect(() => {
    if (profile && profile.role === "caregiver") {
      fetchElders();
    } else if (!authLoading) {
      setIsLoading(false);
    }
  }, [profile, authLoading]);

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

      const { data: elderProfiles, error: profileErr } = await supabase
        .from("profiles")
        .select(`
          id, 
          full_name, 
          phone,
          medicines!medicines_elder_id_fkey (
            name,
            dosage,
            is_active
          ),
          emergency_contacts (
            name,
            phone,
            relationship
          )
        `)
        .in("id", elderIds);

      // Filter out inactive medicines from each elder profile
      const activeProfiles = (elderProfiles as any[])?.map((elder: any) => ({
        ...elder,
        medicines: (elder.medicines || []).filter((m: any) => m.is_active !== false),
      })) || [];

      if (profileErr) throw profileErr;

      const typedProfiles = activeProfiles;
      setElders(typedProfiles);

      const medsMap: Record<string, MedicineSummary> = {};
      const contactsMap: Record<string, number> = {};

      for (const elderId of elderIds) {
        // Medicines count
        const elderMeds = typedProfiles.find((e: any) => e.id === elderId)?.medicines || [];
        
        const today = format(new Date(), "yyyy-MM-dd");
        const { data: todayLogs } = await supabase
          .from("medicine_logs")
          .select("id, status")
          .gte("scheduled_time", `${today}T00:00:00`)
          .lte("scheduled_time", `${today}T23:59:59`);

        medsMap[elderId] = {
          total: elderMeds.length,
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
    } catch (error: any) {
      console.error("CaregiverPortal: Error fetching data:", error);
      toast.error("Failed to load elders: " + error.message);
    } finally {
      setIsLoading(false);
    }
  };

  const handleBecomeCaregiver = async () => {
    if (!profile) return;
    setIsSwitchingRole(true);
    try {
      const { error } = await supabase
        .from("profiles")
        .update({ role: "caregiver" })
        .eq("id", profile.id);

      if (error) throw error;
      
      toast.success("Role updated! Refreshing page...");
      // Force a hard reload to clear any cached profile state
      setTimeout(() => {
        window.location.href = window.location.origin + "/caregiver";
      }, 1000);
    } catch (error: any) {
      toast.error("Failed to update role: " + error.message);
    } finally {
      setIsSwitchingRole(false);
    }
  };

  const handleAddElder = async () => {
    if (!profile || !newElderName) return;
    setIsAddingElder(true);

    try {
      // 1. Create elder profile
      const { data: newElder, error: profileError } = await supabase
        .from("profiles")
        .insert({
          full_name: newElderName,
          phone: newElderPhone,
          role: "elder",
        })
        .select()
        .single();

      if (profileError) throw profileError;

      // 2. Create family connection
      const { error: connError } = await supabase
        .from("family_connections")
        .insert({
          caregiver_id: profile.id,
          elder_id: newElder.id,
        });

      if (connError) throw connError;

      toast.success("Elder profile added successfully!");
      setIsAddingElder(false);
      setNewElderName("");
      setNewElderPhone("");
      // Force immediate refresh
      fetchElders();
    } catch (error: any) {
      console.error("Error adding elder:", error);
      toast.error("Failed to add elder: " + error.message);
    } finally {
      setIsAddingElder(false);
    }
  };

  const handleDeleteProfile = async () => {
    if (!profileToDelete) return;
    setIsDeleting(true);

    try {
      const { error } = await supabase
        .from("profiles")
        .delete()
        .eq("id", profileToDelete);

      if (error) throw error;

      setElders(elders.filter(e => e.id !== profileToDelete));
      toast.success("Elder profile removed successfully");
    } catch (error: any) {
      console.error("Error deleting profile:", error);
      toast.error("Failed to remove profile: " + error.message);
    } finally {
      setIsDeleting(false);
      setProfileToDelete(null);
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
        <main className="container py-12 text-center max-w-md mx-auto">
          <div className="bg-primary/10 p-4 rounded-full w-20 h-20 flex items-center justify-center mx-auto mb-6">
            <Users className="h-10 w-10 text-primary" />
          </div>
          <h2 className="text-2xl font-bold mb-4">Caregiver Access Only</h2>
          <p className="text-muted-foreground mb-8 text-lg">
            This portal is for caregivers to monitor their elders. To get started, you can set your role as a caregiver.
          </p>
          <Button 
            size="lg" 
            className="w-full h-14 text-lg" 
            onClick={handleBecomeCaregiver}
            disabled={isSwitchingRole}
          >
            {isSwitchingRole ? (
              <Loader2 className="mr-2 h-5 w-5 animate-spin" />
            ) : null}
            Become a Caregiver
          </Button>
        </main>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <Header onMenuToggle={() => setShowMenu(!showMenu)} showMenu={showMenu} />

      <main className="container py-6 max-w-3xl">
        <motion.div 
          initial={{ opacity: 0, y: 10 }} 
          animate={{ opacity: 1, y: 0 }}
          className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6"
        >
          <div>
            <h1 className="text-2xl font-bold flex items-center gap-2 mb-2">
              <Users className="h-6 w-6 text-primary" />
              Caregiver Portal
            </h1>
            <p className="text-muted-foreground">Monitor your elders' health and wellbeing</p>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" size="icon" onClick={fetchElders} disabled={isLoading}>
              <Loader2 className={cn("h-4 w-4", isLoading && "animate-spin")} />
            </Button>
            <Dialog>
            <DialogTrigger asChild>
              <Button className="gap-2">
                <Users className="h-4 w-4" />
                Add New Elder
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Add New Elder Profile</DialogTitle>
                <DialogDescription>
                  Create a new profile to monitor their medications and health.
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-4 py-4">
                <div className="space-y-2">
                  <Label htmlFor="name">Full Name</Label>
                  <Input 
                    id="name" 
                    placeholder="Enter full name" 
                    value={newElderName}
                    onChange={(e) => setNewElderName(e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="phone">Phone Number (Optional)</Label>
                  <Input 
                    id="phone" 
                    placeholder="Enter phone number" 
                    value={newElderPhone}
                    onChange={(e) => setNewElderPhone(e.target.value)}
                  />
                </div>
              </div>
              <DialogFooter>
                <Button 
                  onClick={handleAddElder} 
                  disabled={isAddingElder || !newElderName}
                >
                  {isAddingElder ? (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  ) : null}
                  Create Profile
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>
      </motion.div>

        {elders.length === 0 ? (
          <Card className="border-dashed border-2 bg-muted/20">
            <CardContent className="p-12 text-center">
              <div className="bg-primary/10 p-4 rounded-full w-20 h-20 flex items-center justify-center mx-auto mb-6">
                <Users className="h-10 w-10 text-primary/40" />
              </div>
              <h3 className="font-bold text-2xl mb-2">No Elders Connected</h3>
              <p className="text-muted-foreground text-lg mb-8 max-w-md mx-auto">
                You haven't connected any elder profiles yet. You can either set up a new profile with a full health history or quickly add a name below.
              </p>
              <div className="flex flex-col sm:flex-row gap-4 justify-center">
                <Button asChild size="lg" className="h-14 px-8 text-lg">
                  <Link to="/onboarding">Full Health Setup</Link>
                </Button>
                <Dialog>
                  <DialogTrigger asChild>
                    <Button variant="outline" size="lg" className="h-14 px-8 text-lg">
                      Quick Add Profile
                    </Button>
                  </DialogTrigger>
                  <DialogContent>
                    <DialogHeader>
                      <DialogTitle>Quick Add Elder</DialogTitle>
                    </DialogHeader>
                    <div className="space-y-4 py-4">
                      <div className="space-y-2">
                        <Label htmlFor="quick-name">Full Name</Label>
                        <Input 
                          id="quick-name" 
                          placeholder="Enter full name" 
                          value={newElderName}
                          onChange={(e) => setNewElderName(e.target.value)}
                        />
                      </div>
                    </div>
                    <DialogFooter>
                      <Button onClick={handleAddElder} disabled={isAddingElder || !newElderName}>
                        {isAddingElder ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                        Add Elder
                      </Button>
                    </DialogFooter>
                  </DialogContent>
                </Dialog>
              </div>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-6">
            {elders.map((elder: ElderProfile, index: number) => (
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
                  <CardContent className="space-y-4">
                    <div className="grid gap-4 sm:grid-cols-2">
                      {/* Medicines Summary */}
                      <Card className="bg-success/5 border-success/20">
                        <CardContent className="p-4">
                          <div className="flex items-center gap-2 mb-2">
                            <Pill className="h-4 w-4 text-success" />
                            <span className="text-sm font-medium">Daily Progress</span>
                          </div>
                          <p className="text-2xl font-bold">{elderMedicines[elder.id]?.takenToday || 0} / {elderMedicines[elder.id]?.total || 0}</p>
                          <p className="text-xs text-muted-foreground">
                            medications taken today
                          </p>
                        </CardContent>
                      </Card>
 
                      {/* Emergency Contacts Count */}
                      <Card className="bg-warning/5 border-warning/20">
                        <CardContent className="p-4">
                          <div className="flex items-center gap-2 mb-2">
                            <Phone className="h-4 w-4 text-warning" />
                            <span className="text-sm font-medium">Safety Contacts</span>
                          </div>
                          <p className="text-2xl font-bold">{elderContacts[elder.id] || 0}</p>
                          <p className="text-xs text-muted-foreground">emergency contacts registered</p>
                        </CardContent>
                      </Card>
                    </div>

                    {/* Detailed Emergency Contacts */}
                    {elder.emergency_contacts && elder.emergency_contacts.length > 0 && (
                      <div className="bg-warning/5 rounded-lg p-4 border border-warning/10">
                        <h4 className="text-sm font-semibold mb-3 flex items-center gap-2 text-warning-foreground">
                          <Phone className="h-4 w-4" />
                          Emergency Contacts
                        </h4>
                        <div className="grid gap-2 sm:grid-cols-2">
                          {elder.emergency_contacts.map((contact, idx) => (
                            <div key={idx} className="bg-background/50 p-2 rounded border border-warning/20 text-xs">
                              <p className="font-bold">{contact.name}</p>
                              <p className="text-muted-foreground">{contact.phone}</p>
                              <p className="text-[10px] uppercase font-bold text-warning/70">{contact.relationship}</p>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Detailed Medicines List */}
                    {elder.medicines && elder.medicines.length > 0 && (
                      <div className="bg-success/5 rounded-lg p-4 border border-success/10">
                        <h4 className="text-sm font-semibold mb-3 flex items-center gap-2 text-success-foreground">
                          <Pill className="h-4 w-4" />
                          Current Schedule
                        </h4>
                        <div className="space-y-2">
                          {elder.medicines.map((med, idx) => (
                            <div key={idx} className="flex items-center justify-between bg-background/50 p-2 rounded border border-success/20 text-sm">
                              <span className="font-medium">{med.name}</span>
                              <span className="text-muted-foreground">{med.dosage}</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    <div className="flex justify-end pt-2">
                      <Button 
                        variant="ghost" 
                        size="sm" 
                        className="text-destructive hover:text-destructive hover:bg-destructive/10"
                        onClick={() => setProfileToDelete(elder.id)}
                      >
                        <Trash2 className="h-4 w-4 mr-2" />
                        Remove Elder Profile
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              </motion.div>
            ))}
          </div>
        )}
      </main>

      <AlertDialog open={!!profileToDelete} onOpenChange={() => setProfileToDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-destructive" />
              Are you absolutely sure?
            </AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently remove the elder's profile from your portal. This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction 
              onClick={handleDeleteProfile}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              disabled={isDeleting}
            >
              {isDeleting ? "Removing..." : "Remove Profile"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
