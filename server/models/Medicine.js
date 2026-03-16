import mongoose from "mongoose";

const medicineSchema = new mongoose.Schema({
    elder_id: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    name: { type: String, required: true },
    dosage: { type: String, required: true },
    frequency: { type: String, required: true },
    times: [{ type: String }],
    instructions: { type: String, default: null },
    is_active: { type: Boolean, default: true },
    created_by: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null },
}, { timestamps: true });

export default mongoose.model("Medicine", medicineSchema);
