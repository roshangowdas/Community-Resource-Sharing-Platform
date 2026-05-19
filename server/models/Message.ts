import mongoose from 'mongoose';

const messageSchema = new mongoose.Schema({
  request: { type: mongoose.Schema.Types.ObjectId, ref: 'Request', required: true },
  sender: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: false },
  text: { type: String, required: true },
  isSystem: { type: Boolean, default: false },
  createdAt: { type: Date, default: Date.now }
});

export const Message = mongoose.model('Message', messageSchema);
