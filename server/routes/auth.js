import { Router } from "express";
import jwt from "jsonwebtoken";
import User from "../models/User.js";
import { auth } from "../middleware/auth.js";

const router = Router();

// Sign Up
router.post("/signup", async (req, res) => {
    try {
        const { email, password, full_name } = req.body;
        if (!email || !password || !full_name) {
            return res.status(400).json({ error: "Email, password, and full name are required" });
        }

        const existing = await User.findOne({ email });
        if (existing) {
            return res.status(409).json({ error: "Email already registered" });
        }

        const user = await User.create({ email, password, full_name, role: "caregiver" });
        const token = jwt.sign({ userId: user._id }, process.env.JWT_SECRET, { expiresIn: "30d" });

        res.status(201).json({ user: user.toJSON(), token });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Sign In
router.post("/signin", async (req, res) => {
    try {
        const { email, password } = req.body;
        if (!email || !password) {
            return res.status(400).json({ error: "Email and password are required" });
        }

        const user = await User.findOne({ email });
        if (!user) {
            return res.status(401).json({ error: "Invalid email or password" });
        }

        const isMatch = await user.comparePassword(password);
        if (!isMatch) {
            return res.status(401).json({ error: "Invalid email or password" });
        }

        const token = jwt.sign({ userId: user._id }, process.env.JWT_SECRET, { expiresIn: "30d" });
        res.json({ user: user.toJSON(), token });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Get current user profile
router.get("/me", auth, async (req, res) => {
    try {
        const user = await User.findById(req.userId);
        if (!user) return res.status(404).json({ error: "User not found" });
        res.json({ user: user.toJSON() });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

export default router;
