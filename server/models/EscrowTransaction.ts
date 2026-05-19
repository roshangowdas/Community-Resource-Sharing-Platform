import mongoose from 'mongoose';

const transactionSchema = new mongoose.Schema({
  type: { type: String, enum: ['deposit', 'refund', 'compensation'], required: true },
  amount: { type: Number, required: true },
  from: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  to: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  request: { type: mongoose.Schema.Types.ObjectId, ref: 'Request' },
  status: { type: String, enum: ['pending', 'completed', 'failed'], default: 'completed' },
  createdAt: { type: Date, default: Date.now }
});

export const EscrowTransaction = mongoose.model('EscrowTransaction', transactionSchema);
