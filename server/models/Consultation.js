import mongoose from "mongoose";

const consultationSchema = new mongoose.Schema({
    elder_id: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    specialist_id: { type: String, required: true },
    specialist_name: { type: String, required: true },
    summary: { type: String, default: null },
    messages: { type: mongoose.Schema.Types.Mixed, default: [] },
}, { timestamps: true });

export default mongoose.model("Consultation", consultationSchema);
