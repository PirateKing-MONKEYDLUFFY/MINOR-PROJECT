import mongoose from "mongoose";

const wellnessCheckinSchema = new mongoose.Schema({
    elder_id: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    mood: { type: String, required: true },
    notes: { type: String, default: null },
    symptoms: [{ type: String }],
}, { timestamps: true });

export default mongoose.model("WellnessCheckin", wellnessCheckinSchema);
