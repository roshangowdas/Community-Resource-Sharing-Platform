import mongoose from 'mongoose';

const disputeSchema = new mongoose.Schema({
  request: { type: mongoose.Schema.Types.ObjectId, ref: 'Request', required: true },
  reporter: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  reason: { type: String, required: true },
  description: { type: String, required: true },
  evidenceImages: [String],
  status: { type: String, enum: ['open', 'under_review', 'resolved', 'closed'], default: 'open' },
  resolution: {
    winner: { type: String, enum: ['owner', 'borrower', 'split'] },
    ownerAmount: Number,
    borrowerAmount: Number,
    adminNotes: String,
    resolvedAt: Date
  },
  createdAt: { type: Date, default: Date.now }
});

export const Dispute = mongoose.model('Dispute', disputeSchema);
