import mongoose from "mongoose";

const emergencyContactSchema = new mongoose.Schema({
    elder_id: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    name: { type: String, required: true },
    phone: { type: String, required: true },
    relationship: { type: String, default: null },
    is_primary: { type: Boolean, default: false },
}, { timestamps: true });

export default mongoose.model("EmergencyContact", emergencyContactSchema);
