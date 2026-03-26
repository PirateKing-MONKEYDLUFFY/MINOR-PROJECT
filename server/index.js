import "dotenv/config";
import express from "express";
import cors from "cors";
import { connectDB } from "./config/db.js";
import authRoutes from "./routes/auth.js";
import onboardingRoutes from "./routes/onboarding.js";
import medicinesRoutes from "./routes/medicines.js";
import wellnessRoutes from "./routes/wellness.js";
import caregiverRoutes from "./routes/caregiver.js";
import aiRoutes from "./routes/ai.js";

const app = express();
const PORT = process.env.PORT || 3001;

// Middleware
app.use(cors());
app.use(express.json({ limit: "10mb" }));

// Routes
app.use("/api/auth", authRoutes);
app.use("/api/onboarding", onboardingRoutes);
app.use("/api/medicines", medicinesRoutes);
app.use("/api/wellness", wellnessRoutes);
app.use("/api/caregiver", caregiverRoutes);
app.use("/api/ai", aiRoutes);

// Health check
app.get("/api/health", (req, res) => {
    res.json({ status: "ok", timestamp: new Date().toISOString() });
});

// Start server
connectDB().then(() => {
    app.listen(PORT, () => {
        console.log(`🚀 VoiceAid server running on http://localhost:${PORT}`);
    });
});
