import mongoose from 'mongoose';

const requestSchema = new mongoose.Schema({
  item: { type: mongoose.Schema.Types.ObjectId, ref: 'Item', required: true },
  requester: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  owner: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  status: { type: String, enum: ['pending', 'approved', 'deposit_paid', 'item_handed_over', 'borrowed', 'return_requested', 'returned', 'completed', 'disputed', 'cancelled', 'rejected'], default: 'pending' },
  message: String,
  borrowStartDate: Date,
  borrowEndDate: Date,
  actualReturnDate: Date,
  depositAmount: Number,
  insuranceFee: { type: Number, default: 0 },
  insuranceCovered: { type: Boolean, default: false },
  
  // Handover Verification (Dual Protocol)
  borrowerHandoverToken: String,
  ownerHandoverToken: String,
  borrowerHandoverVerified: { type: Boolean, default: false },
  ownerHandoverVerified: { type: Boolean, default: false },
  handoverVerifiedAt: Date,
  handoverProofMedia: [String], // Video/Photo proof at the start
  
  // Return Verification
  returnQRCode: String,
  returnQRDataURL: String, // Server-side generated base64 image
  returnVerifiedAt: Date,
  returnProofMedia: [String], // Video/Photo proof at the end
  
  // AI Condition Analysis
  handoverConditionReport: String,
  returnConditionReport: String,
  aiDamageDetected: { type: Boolean, default: false },

  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now }
});

requestSchema.index({ requester: 1 });
requestSchema.index({ owner: 1 });
requestSchema.index({ item: 1 });
requestSchema.index({ status: 1 });

export const Request = mongoose.model('Request', requestSchema);
