import { Router } from "express";
import { auth } from "../middleware/auth.js";
import WellnessCheckin from "../models/WellnessCheckin.js";

const router = Router();

// Get recent check-ins
router.get("/", auth, async (req, res) => {
    try {
        const checkins = await WellnessCheckin.find({ elder_id: req.userId })
            .sort({ createdAt: -1 })
            .limit(14);
        res.json({ checkins });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Create check-in
router.post("/", auth, async (req, res) => {
    try {
        const { mood, notes, symptoms } = req.body;
        if (!mood) return res.status(400).json({ error: "Mood is required" });

        const checkin = await WellnessCheckin.create({
            elder_id: req.userId,
            mood,
            notes: notes?.trim() || null,
            symptoms: symptoms?.length > 0 ? symptoms : [],
        });
        res.status(201).json({ checkin });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

export default router;
