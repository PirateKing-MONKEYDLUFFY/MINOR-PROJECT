import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Stethoscope, User, Pill, Phone, ArrowRight, ArrowLeft, Plus, Trash2, Loader2, Check } from "lucide-react";
import { toast } from "@/hooks/use-toast";
import { motion, AnimatePresence } from "framer-motion";
import { cn } from "@/lib/utils";

interface MedicineEntry {
  name: string;
  dosage: string;
  frequency: string;
  times: string[];
  instructions: string;
}

interface ContactEntry {
  name: string;
  phone: string;
  relationship: string;
  is_primary: boolean;
}

const STEPS = ["Elder Details", "Medicines", "Emergency Contacts"];

const formatPhoneNumber = (value: string) => {
  // Remove all non-digits
  const digits = value.replace(/\D/g, "");
  // Remove 91 if it's already there at the start to prevent duplication
  const mainDigits = digits.startsWith("91") ? digits.slice(2) : digits;
  // Limit to 10 digits
  const limited = mainDigits.slice(0, 10);
  return limited ? `+91${limited}` : "";
};

export default function Onboarding() {
  const navigate = useNavigate();
  const { user, refreshProfile } = useAuth();
  const [step, setStep] = useState(0);
  const [isLoading, setIsLoading] = useState(false);

  // Step 1: Elder details
  const [elderName, setElderName] = useState("");
  const [elderPhone, setElderPhone] = useState("");

  // Step 2: Medicines
  const [medicines, setMedicines] = useState<MedicineEntry[]>([
    { name: "", dosage: "", frequency: "daily", times: ["08:00"], instructions: "" },
  ]);

  // Step 3: Emergency contacts
  const [contacts, setContacts] = useState<ContactEntry[]>([
    { name: "", phone: "", relationship: "child", is_primary: true },
  ]);

  const addMedicine = () => {
    setMedicines([...medicines, { name: "", dosage: "", frequency: "daily", times: ["08:00"], instructions: "" }]);
  };

  const removeMedicine = (idx: number) => {
    setMedicines(medicines.filter((_, i) => i !== idx));
  };

  const updateMedicine = (idx: number, field: keyof MedicineEntry, value: any) => {
    const updated = [...medicines];
    (updated[idx] as any)[field] = value;
    setMedicines(updated);
  };

  const addContact = () => {
    setContacts([...contacts, { name: "", phone: "", relationship: "", is_primary: false }]);
  };

  const removeContact = (idx: number) => {
    setContacts(contacts.filter((_, i) => i !== idx));
  };

  const updateContact = (idx: number, field: keyof ContactEntry, value: any) => {
    const updated = [...contacts];
    (updated[idx] as any)[field] = value;
    setContacts(updated);
  };

  const handleComplete = async () => {
    if (!user) return;
    setIsLoading(true);

    try {
      // 1. Create elder profile
      const { data: elderProfile, error: elderErr } = await supabase
        .from("profiles")
        .insert({
          full_name: elderName,
          role: "elder" as const,
          phone: elderPhone || null,
          user_id: null as any, // user_id is nullable now
        })
        .select()
        .single();

      if (elderErr) throw elderErr;

      // 2. Get caregiver profile
      let { data: caregiverProfile } = await supabase
        .from("profiles")
        .select("id")
        .eq("user_id", user.id)
        .eq("role", "caregiver")
        .maybeSingle();
      
      if (!caregiverProfile) {
        const { data: newCaregiver, error: createErr } = await supabase
          .from("profiles")
          .insert({
            user_id: user.id,
            full_name: user.user_metadata?.full_name || user.email?.split("@")[0] || "Caregiver",
            role: "caregiver"
          })
          .select()
          .single();
        
        if (createErr) throw createErr;
        caregiverProfile = newCaregiver;
      }

      // 3. Create family connection & Add medicines & Add emergency contacts in parallel
      const operations = [];

      if (caregiverProfile) {
        operations.push(supabase.from("family_connections").insert({
          caregiver_id: caregiverProfile.id,
          elder_id: elderProfile.id,
          relationship: "family",
          is_primary_contact: true,
        }));
      }

      const validMeds = medicines.filter((m) => m.name.trim());
      if (validMeds.length > 0) {
        operations.push(supabase.from("medicines").insert(
          validMeds.map((m) => ({
            elder_id: elderProfile.id,
            name: m.name,
            dosage: m.dosage || "As prescribed",
            frequency: m.frequency,
            times: m.times,
            instructions: m.instructions || null,
            created_by: caregiverProfile?.id || null,
          }))
        ));
      }

      const validContacts = contacts.filter((c) => c.name.trim() && c.phone.trim());
      if (validContacts.length > 0) {
        operations.push(supabase.from("emergency_contacts").insert(
          validContacts.map((c) => ({
            elder_id: elderProfile.id,
            name: c.name,
            phone: c.phone,
            relationship: c.relationship || null,
            is_primary: c.is_primary,
          }))
        ));
      }

      await Promise.all(operations);
      await refreshProfile();

      toast({ title: "Setup complete! 🎉", description: `${elderName}'s profile is ready.` });
      navigate("/dashboard");
    } catch (error: any) {
      console.error("Onboarding error:", error);
      toast({ title: "Setup failed", description: error.message, variant: "destructive" });
    } finally {
      setIsLoading(false);
    }
  };

  const canProceed = () => {
    if (step === 0) return elderName.trim().length > 0;
    if (step === 1) return true; // medicines optional
    if (step === 2) return contacts.some((c) => c.name.trim() && c.phone.trim());
    return true;
  };

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="w-full max-w-lg">
        {/* Logo */}
        <div className="text-center mb-6">
          <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-2xl bg-primary text-primary-foreground">
            <Stethoscope className="h-6 w-6" />
          </div>
          <h1 className="text-xl font-bold">Set Up Elder's Profile</h1>
        </div>

        {/* Progress */}
        <div className="flex gap-2 mb-6">
          {STEPS.map((s, i) => (
            <div key={s} className="flex-1">
              <div className={cn("h-2 rounded-full transition-colors", i <= step ? "bg-primary" : "bg-muted")} />
              <p className={cn("text-xs mt-1 text-center", i <= step ? "text-primary font-medium" : "text-muted-foreground")}>{s}</p>
            </div>
          ))}
        </div>

        <Card>
          <AnimatePresence mode="wait">
            {step === 0 && (
              <motion.div key="step0" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }}>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2 text-lg">
                    <User className="h-5 w-5 text-primary" /> Elder's Information
                  </CardTitle>
                  <CardDescription>Enter the details of the person you're caring for</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="elder-name">Full Name *</Label>
                    <Input id="elder-name" value={elderName} onChange={(e) => setElderName(e.target.value)} placeholder="e.g. Margaret Johnson" className="h-12 text-base" />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="elder-phone">Phone Number (10 digits) *</Label>
                    <div className="relative">
                      <Input 
                        id="elder-phone" 
                        value={elderPhone} 
                        onChange={(e) => setElderPhone(formatPhoneNumber(e.target.value))} 
                        placeholder="+91 XXXXXXXXXX" 
                        className="h-12 text-base" 
                        required
                      />
                    </div>
                  </div>
                </CardContent>
              </motion.div>
            )}

            {step === 1 && (
              <motion.div key="step1" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }}>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2 text-lg">
                    <Pill className="h-5 w-5 text-primary" /> Daily Medicines
                  </CardTitle>
                  <CardDescription>Add medicines and their schedules (can be updated later)</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  {medicines.map((med, idx) => (
                    <div key={idx} className="p-4 rounded-xl border bg-muted/30 space-y-3">
                      <div className="flex items-center justify-between">
                        <span className="text-sm font-medium">Medicine {idx + 1}</span>
                        {medicines.length > 1 && (
                          <Button variant="ghost" size="icon" onClick={() => removeMedicine(idx)} className="h-8 w-8">
                            <Trash2 className="h-4 w-4 text-destructive" />
                          </Button>
                        )}
                      </div>
                      <Input value={med.name} onChange={(e) => updateMedicine(idx, "name", e.target.value)} placeholder="Medicine name" className="h-11" />
                      <div className="grid grid-cols-2 gap-2">
                        <Input value={med.dosage} onChange={(e) => updateMedicine(idx, "dosage", e.target.value)} placeholder="Dosage (e.g. 10mg)" className="h-11" />
                        <select
                          value={med.frequency}
                          onChange={(e) => updateMedicine(idx, "frequency", e.target.value)}
                          className="h-11 rounded-md border border-input bg-background px-3 text-sm"
                        >
                          <option value="daily">Daily</option>
                          <option value="twice_daily">Twice Daily</option>
                          <option value="weekly">Weekly</option>
                          <option value="as_needed">As Needed</option>
                        </select>
                      </div>
                      <div className="space-y-1">
                        <Label className="text-xs">Time(s)</Label>
                        <div className="flex gap-2 flex-wrap">
                          {med.times.map((t, ti) => (
                            <Input
                              key={ti}
                              type="time"
                              value={t}
                              onChange={(e) => {
                                const newTimes = [...med.times];
                                newTimes[ti] = e.target.value;
                                updateMedicine(idx, "times", newTimes);
                              }}
                              className="h-10 w-32"
                            />
                          ))}
                          <Button variant="outline" size="sm" onClick={() => updateMedicine(idx, "times", [...med.times, "12:00"])} className="h-10">
                            <Plus className="h-3 w-3" />
                          </Button>
                        </div>
                      </div>
                      <Input value={med.instructions} onChange={(e) => updateMedicine(idx, "instructions", e.target.value)} placeholder="Instructions (e.g. Take after meals)" className="h-11" />
                    </div>
                  ))}
                  <Button variant="outline" onClick={addMedicine} className="w-full">
                    <Plus className="h-4 w-4 mr-2" /> Add Another Medicine
                  </Button>
                </CardContent>
              </motion.div>
            )}

            {step === 2 && (
              <motion.div key="step2" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }}>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2 text-lg">
                    <Phone className="h-5 w-5 text-primary" /> Emergency Contacts
                  </CardTitle>
                  <CardDescription>Add contacts who should be alerted in case of emergency</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  {contacts.map((contact, idx) => (
                    <div key={idx} className="p-4 rounded-xl border bg-muted/30 space-y-3">
                      <div className="flex items-center justify-between">
                        <span className="text-sm font-medium">
                          Contact {idx + 1} {contact.is_primary && <span className="text-primary">(Primary)</span>}
                        </span>
                        {contacts.length > 1 && (
                          <Button variant="ghost" size="icon" onClick={() => removeContact(idx)} className="h-8 w-8">
                            <Trash2 className="h-4 w-4 text-destructive" />
                          </Button>
                        )}
                      </div>
                      <Input value={contact.name} onChange={(e) => updateContact(idx, "name", e.target.value)} placeholder="Contact name" className="h-11" required />
                      <Input 
                        value={contact.phone} 
                        onChange={(e) => updateContact(idx, "phone", formatPhoneNumber(e.target.value))} 
                        placeholder="+91 XXXXXXXXXX" 
                        className="h-11" 
                        required
                      />
                      <Input value={contact.relationship} onChange={(e) => updateContact(idx, "relationship", e.target.value)} placeholder="Relationship (e.g. Son, Daughter)" className="h-11" />
                    </div>
                  ))}
                  <Button variant="outline" onClick={addContact} className="w-full">
                    <Plus className="h-4 w-4 mr-2" /> Add Another Contact
                  </Button>
                </CardContent>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Navigation */}
          <div className="p-6 pt-0 flex gap-3">
            {step > 0 && (
              <Button variant="outline" onClick={() => setStep(step - 1)} className="flex-1 h-12">
                <ArrowLeft className="h-4 w-4 mr-2" /> Back
              </Button>
            )}
            {step < 2 ? (
              <Button onClick={() => setStep(step + 1)} disabled={!canProceed()} className="flex-1 h-12">
                Next <ArrowRight className="h-4 w-4 ml-2" />
              </Button>
            ) : (
              <Button onClick={handleComplete} disabled={!canProceed() || isLoading} className="flex-1 h-12">
                {isLoading ? (
                  <Loader2 className="h-4 w-4 animate-spin mr-2" />
                ) : (
                  <Check className="h-4 w-4 mr-2" />
                )}
                Complete Setup
              </Button>
            )}
          </div>
        </Card>

        <p className="text-xs text-muted-foreground text-center mt-4">
          You can skip medicines and add them later from the dashboard.
        </p>
      </motion.div>
    </div>
  );
}
