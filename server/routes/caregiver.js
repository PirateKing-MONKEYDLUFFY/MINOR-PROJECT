import { Router } from "express";
import { auth } from "../middleware/auth.js";
import FamilyConnection from "../models/FamilyConnection.js";
import User from "../models/User.js";
import Medicine from "../models/Medicine.js";
import MedicineLog from "../models/MedicineLog.js";
import WellnessCheckin from "../models/WellnessCheckin.js";
import EmergencyContact from "../models/EmergencyContact.js";

const router = Router();

// Get full caregiver portal data
router.get("/", auth, async (req, res) => {
    try {
        // Get family connections
        const connections = await FamilyConnection.find({ caregiver_id: req.userId });
        if (!connections.length) return res.json({ elders: [] });

        const elderIds = connections.map((c) => c.elder_id);
        const elderProfiles = await User.find({ _id: { $in: elderIds } });

        const today = new Date();
        today.setHours(0, 0, 0, 0);
        const tomorrow = new Date(today);
        tomorrow.setDate(tomorrow.getDate() + 1);

        const elders = await Promise.all(
            elderProfiles.map(async (elder) => {
                const medicines = await Medicine.find({ elder_id: elder._id, is_active: true });
                const todayLogs = await MedicineLog.find({
                    scheduled_time: { $gte: today, $lt: tomorrow },
                    medicine_id: { $in: medicines.map((m) => m._id) },
                });
                const wellness = await WellnessCheckin.find({ elder_id: elder._id })
                    .sort({ createdAt: -1 })
                    .limit(7);
                const contacts = await EmergencyContact.countDocuments({ elder_id: elder._id });

                return {
                    id: elder._id,
                    full_name: elder.full_name,
                    phone: elder.phone,
                    medicines: {
                        total: medicines.length,
                        takenToday: todayLogs.filter((l) => l.status === "taken").length,
                    },
                    wellness: wellness.map((w) => ({ mood: w.mood, created_at: w.createdAt })),
                    contactsCount: contacts,
                };
            })
        );

        res.json({ elders });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

export default router;
