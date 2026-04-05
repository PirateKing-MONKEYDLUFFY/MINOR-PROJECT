import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { AuthProvider } from "@/hooks/useAuth";
import Landing from "./pages/Landing";
import Dashboard from "./pages/Dashboard";
import Consultation from "./pages/Consultation";
import History from "./pages/History";
import Auth from "./pages/Auth";
import Onboarding from "./pages/Onboarding";
import Medicines from "./pages/Medicines";
import CaregiverPortal from "./pages/CaregiverPortal";
import NotFound from "./pages/NotFound";
import { EmergencyListener } from "@/components/voice/EmergencyListener";
import { MedicineReminder } from "@/components/medicines/MedicineReminder";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <AuthProvider>
      <TooltipProvider>
        <Toaster />
        <Sonner />
        <BrowserRouter>
          <EmergencyListener />
          <MedicineReminder />
          <Routes>
            <Route path="/" element={<Landing />} />
            <Route path="/auth" element={<Auth />} />
            <Route path="/onboarding" element={<Onboarding />} />
            <Route path="/dashboard" element={<Dashboard />} />
            <Route path="/consultation/:specialistId" element={<Consultation />} />
            <Route path="/history" element={<History />} />
            <Route path="/medicines" element={<Medicines />} />
            <Route path="/caregiver" element={<CaregiverPortal />} />
            <Route path="*" element={<NotFound />} />
          </Routes>
        </BrowserRouter>
      </TooltipProvider>
    </AuthProvider>
  </QueryClientProvider>
);

export default App;
