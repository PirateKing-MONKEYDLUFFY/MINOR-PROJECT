import { Router } from "express";
import { auth } from "../middleware/auth.js";
import User from "../models/User.js";
import FamilyConnection from "../models/FamilyConnection.js";
import Medicine from "../models/Medicine.js";
import EmergencyContact from "../models/EmergencyContact.js";

const router = Router();

// Complete onboarding — creates elder profile, family connection, medicines, contacts
router.post("/", auth, async (req, res) => {
    try {
        const { elderName, elderPhone, medicines, contacts } = req.body;

        if (!elderName?.trim()) {
            return res.status(400).json({ error: "Elder name is required" });
        }

        // 1. Create elder user (no password — elder doesn't sign in directly)
        const elder = await User.create({
            email: `elder_${Date.now()}@voiceaid.local`,
            password: "elder-no-login-" + Date.now(),
            full_name: elderName,
            role: "elder",
            phone: elderPhone || null,
        });

        // 2. Create family connection
        const caregiver = await User.findById(req.userId);
        if (caregiver) {
            await FamilyConnection.create({
                caregiver_id: caregiver._id,
                elder_id: elder._id,
                relationship: "family",
                is_primary_contact: true,
            });
        }

        // 3. Add medicines
        const validMeds = (medicines || []).filter((m) => m.name?.trim());
        if (validMeds.length > 0) {
            await Medicine.insertMany(
                validMeds.map((m) => ({
                    elder_id: elder._id,
                    name: m.name,
                    dosage: m.dosage || "As prescribed",
                    frequency: m.frequency || "daily",
                    times: m.times || ["08:00"],
                    instructions: m.instructions || null,
                    created_by: caregiver?._id || null,
                }))
            );
        }

        // 4. Add emergency contacts
        const validContacts = (contacts || []).filter((c) => c.name?.trim() && c.phone?.trim());
        if (validContacts.length > 0) {
            await EmergencyContact.insertMany(
                validContacts.map((c) => ({
                    elder_id: elder._id,
                    name: c.name,
                    phone: c.phone,
                    relationship: c.relationship || null,
                    is_primary: c.is_primary || false,
                }))
            );
        }

        res.status(201).json({ elder: elder.toJSON() });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

export default router;
