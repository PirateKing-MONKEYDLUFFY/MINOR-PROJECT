import { Router } from "express";
import { auth } from "../middleware/auth.js";
import Medicine from "../models/Medicine.js";
import MedicineLog from "../models/MedicineLog.js";

const router = Router();

// Get medicines for the current user (by elder_id)
router.get("/", auth, async (req, res) => {
    try {
        const medicines = await Medicine.find({ elder_id: req.userId, is_active: true });
        res.json({ medicines });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Get today's medicine logs
router.get("/logs/today", auth, async (req, res) => {
    try {
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        const tomorrow = new Date(today);
        tomorrow.setDate(tomorrow.getDate() + 1);

        const logs = await MedicineLog.find({
            scheduled_time: { $gte: today, $lt: tomorrow },
        });
        res.json({ logs });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Take or skip a medicine
router.post("/log", auth, async (req, res) => {
    try {
        const { medicine_id, scheduled_time, status } = req.body;

        // Check for existing log
        const existing = await MedicineLog.findOne({
            medicine_id,
            scheduled_time: new Date(scheduled_time),
        });

        if (existing) {
            existing.status = status;
            if (status === "taken") existing.taken_at = new Date();
            await existing.save();
            return res.json({ log: existing });
        }

        const log = await MedicineLog.create({
            medicine_id,
            scheduled_time: new Date(scheduled_time),
            status,
            taken_at: status === "taken" ? new Date() : null,
        });
        res.status(201).json({ log });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

export default router;
