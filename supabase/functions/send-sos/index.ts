import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.93.2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { elderId, elderName, message } = await req.json();

    if (!elderId) {
      return new Response(
        JSON.stringify({ error: "Elder profile ID is required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Initialize Supabase admin client to query data
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // 1. Look up caregiver connections for this elder
    const { data: connections, error: connErr } = await supabase
      .from("family_connections")
      .select(`
        caregiver_id,
        relationship,
        profiles!family_connections_caregiver_id_fkey (
          full_name,
          phone
        )
      `)
      .eq("elder_id", elderId);

    if (connErr) {
      console.error("Error fetching connections:", connErr);
    }

    // 2. Also look up emergency contacts
    const { data: emergencyContacts, error: ecErr } = await supabase
      .from("emergency_contacts")
      .select("name, phone, relationship, is_primary")
      .eq("elder_id", elderId)
      .order("is_primary", { ascending: false });

    if (ecErr) {
      console.error("Error fetching emergency contacts:", ecErr);
    }

    // Collect all phone numbers to notify
    const contactsToNotify: Array<{ name: string; phone: string; source: string }> = [];

    // Add caregivers
    if (connections) {
      for (const conn of connections) {
        const profile = (conn as any).profiles;
        if (profile?.phone) {
          contactsToNotify.push({
            name: profile.full_name || "Caregiver",
            phone: profile.phone,
            source: "caregiver",
          });
        }
      }
    }

    // Add emergency contacts
    if (emergencyContacts) {
      for (const ec of emergencyContacts) {
        if (ec.phone) {
          contactsToNotify.push({
            name: ec.name,
            phone: ec.phone,
            source: "emergency_contact",
          });
        }
      }
    }

    // Add verification contact as requested
    contactsToNotify.push({
      name: "Verification Contact",
      phone: "9667826609",
      source: "verification",
    });

    if (contactsToNotify.length === 0) {
      return new Response(
        JSON.stringify({
          success: false,
          error: "No caregiver or emergency contacts found with registered phone numbers. Please add emergency contacts in your profile.",
          contactsNotified: 0,
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // 2.5 Fetch recent health context for n8n Agent
    const { data: recentLogs } = await supabase
      .from("medicine_logs")
      .select(`
        status,
        taken_at,
        scheduled_time,
        medicines (name, dosage)
      `)
      .order("scheduled_time", { ascending: false })
      .limit(5);

    const { data: recentConsultation } = await supabase
      .from("consultations")
      .select("specialist_name, summary, created_at")
      .eq("elder_id", elderId)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    // 3. Send to n8n Automation Agent
    const n8nWebhookUrl = Deno.env.get("N8N_WEBHOOK_URL");

    if (!n8nWebhookUrl) {
      console.log("N8N_WEBHOOK_URL not configured. Returning contacts for in-app alert.");
      return new Response(
        JSON.stringify({
          success: true,
          automationConfigured: false,
          contactsNotified: contactsToNotify.length,
          contacts: contactsToNotify.map(c => ({
            name: c.name,
            phone: c.phone.slice(-4).padStart(c.phone.length, "*")
          })),
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const n8nPayload = {
      event: "emergency_sos",
      elderName: elderName || "User",
      message: message || `🚨 SOS ALERT! ${elderName || "Your elder"} needs help immediately.`,
      contacts: contactsToNotify,
      healthContext: {
        recentMedicineLogs: recentLogs || [],
        lastConsultation: recentConsultation || null,
      },
      timestamp: new Date().toISOString(),
    };

    console.log("Triggering n8n automation agent...");
    const n8nResponse = await fetch(n8nWebhookUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(n8nPayload),
    });

    if (!n8nResponse.ok) {
      const errText = await n8nResponse.text();
      console.error("n8n automation failed:", errText);
      throw new Error(`Automation agent failed: ${errText}`);
    }

    return new Response(
      JSON.stringify({
        success: true,
        automationNotified: true,
        contactsNotified: contactsToNotify.length,
        contacts: contactsToNotify.map(c => ({
          name: c.name,
          phone: c.phone.slice(-4).padStart(c.phone.length, "*")
        })),
        message: "SOS automation triggered successfully.",
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("SOS error:", error);
    return new Response(
      JSON.stringify({
        success: false,
        error: "Failed to process SOS alert. Please call your emergency contacts directly.",
      }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
