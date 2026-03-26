import mongoose from "mongoose";

const familyConnectionSchema = new mongoose.Schema({
    caregiver_id: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    elder_id: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    relationship: { type: String, default: "family" },
    is_primary_contact: { type: Boolean, default: false },
}, { timestamps: true });

familyConnectionSchema.index({ caregiver_id: 1, elder_id: 1 }, { unique: true });

export default mongoose.model("FamilyConnection", familyConnectionSchema);
