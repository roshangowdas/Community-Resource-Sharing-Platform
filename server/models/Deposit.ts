import mongoose from 'mongoose';

const depositSchema = new mongoose.Schema({
  request: { type: mongoose.Schema.Types.ObjectId, ref: 'Request', required: true },
  item: { type: mongoose.Schema.Types.ObjectId, ref: 'Item', required: true },
  depositor: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  amount: { type: Number, required: true },
  status: { type: String, enum: ['escrowed', 'refunded', 'compensated_to_owner', 'disputed'], default: 'escrowed' },
  stripePaymentIntentId: String,
  stripeSessionId: String,
  stripeRefundId: String,
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now }
});

export const Deposit = mongoose.model('Deposit', depositSchema);
