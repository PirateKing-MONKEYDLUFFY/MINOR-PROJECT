import { createContext, useContext, useEffect, useState, ReactNode } from "react";
import { supabase } from "@/integrations/supabase/client";
import type { User, Session } from "@supabase/supabase-js";

interface Profile {
  id: string;
  user_id: string | null;
  full_name: string;
  role: "elder" | "caregiver";
  phone: string | null;
  avatar_url: string | null;
}

interface AuthContextType {
  user: User | null;
  session: Session | null;
  profile: Profile | null;
  isLoading: boolean;
  signOut: () => Promise<void>;
  refreshProfile: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  session: null,
  profile: null,
  isLoading: true,
  signOut: async () => {},
  refreshProfile: async () => {},
});

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const fetchProfile = async (userId: string, currentUser: User | null) => {
    const start = performance.now();
    console.log("useAuth: fetchProfile started for", userId);
    try {
      const { data: profiles, error: profileErr } = await supabase
        .from("profiles")
        .select("*")
        .eq("user_id", userId)
        .limit(1);
      
      if (profileErr) {
        console.error("useAuth: Error fetching primary profile:", profileErr);
        return null;
      }

      let primaryProfile = profiles?.[0] || null;
      
      if (!primaryProfile) {
        console.log("useAuth: No profile found. Creating fallback...");
        const meta = currentUser?.user_metadata;
        const { data: newProfile, error: createErr } = await supabase
          .from("profiles")
          .insert({
            user_id: userId,
            full_name: meta?.full_name || currentUser?.email?.split("@")[0] || "User",
            role: "caregiver"
          })
          .select()
          .single();
        
        if (createErr) {
          console.error("useAuth: Failed to create fallback profile:", createErr);
          return null;
        }
        primaryProfile = newProfile;
      }

      /* 
      // Auto-switching profiles is causing issues for the Caregiver Portal access
      if (primaryProfile.role === "caregiver") {
        const { data: connection } = await supabase
          .from("family_connections")
          .select("elder_id")
          .eq("caregiver_id", primaryProfile.id)
          .maybeSingle();
        
        if (connection?.elder_id) {
          const { data: elderProfile } = await supabase
            .from("profiles")
            .select("*")
            .eq("id", connection.elder_id)
            .maybeSingle();
          
          if (elderProfile) {
            console.log("useAuth: Switched to Elder profile in", performance.now() - start, "ms");
            return elderProfile as Profile;
          }
        }
      }
      */

      console.log("useAuth: Returning primary profile in", performance.now() - start, "ms");
      return primaryProfile as Profile;
    } catch (error) {
      console.error("useAuth: Fatal error in fetchProfile:", error);
      return null;
    }
  };

  const refreshProfile = async () => {
    if (user) {
      const p = await fetchProfile(user.id, user);
      setProfile(p);
    }
  };

  useEffect(() => {
    const updateAuthState = async (session: Session | null) => {
      const currentUser = session?.user ?? null;
      setSession(session);
      setUser(currentUser);
      
      if (currentUser) {
        const p = await fetchProfile(currentUser.id, currentUser);
        setProfile(p);
      } else {
        setProfile(null);
      }
      setIsLoading(false);
    };

    // Initial check
    supabase.auth.getSession().then(({ data: { session } }) => {
      console.log("useAuth: Initial session check completed");
      updateAuthState(session);
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
      console.log("useAuth: auth event", event);
      if (event === "SIGNED_IN" || event === "TOKEN_REFRESHED" || event === "USER_UPDATED") {
        updateAuthState(session);
      } else if (event === "SIGNED_OUT") {
        updateAuthState(null);
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  const signOut = async () => {
    console.log("useAuth: signOut initiated");
    // Clear local state IMMEDIATELY to prevent UI hang
    setProfile(null);
    setUser(null);
    setSession(null);
    localStorage.clear();
    sessionStorage.clear();
    
    try {
      const { error } = await supabase.auth.signOut();
      if (error) {
        console.error("useAuth: Supabase signOut error:", error);
      } else {
        console.log("useAuth: Supabase signOut call finished successfully");
      }
    } catch (error) {
      console.error("useAuth: signOut server-side error (ignoring):", error);
    }
  };

  return (
    <AuthContext.Provider value={{ user, session, profile, isLoading, signOut, refreshProfile }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}
