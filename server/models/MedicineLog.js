import mongoose from "mongoose";

const medicineLogSchema = new mongoose.Schema({
    medicine_id: { type: mongoose.Schema.Types.ObjectId, ref: "Medicine", required: true },
    scheduled_time: { type: Date, required: true },
    status: { type: String, default: "pending", enum: ["taken", "skipped", "pending", "missed"] },
    taken_at: { type: Date, default: null },
    notes: { type: String, default: null },
}, { timestamps: true });

export default mongoose.model("MedicineLog", medicineLogSchema);
