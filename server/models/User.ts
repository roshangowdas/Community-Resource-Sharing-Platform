import mongoose from 'mongoose';

const userSchema = new mongoose.Schema({
  name: { type: String, required: true },
  email: { type: String, required: true, unique: true },
  password: { type: String }, // Optional for Firebase/OAuth users
  firebaseUid: { type: String, unique: true, sparse: true },
  avatar: String,
  location: String,
  bio: String,
  rating: { type: Number, default: 0 },
  reviewCount: { type: Number, default: 0 },
  createdAt: { type: Date, default: Date.now },
  isAdmin: { type: Boolean, default: false },
  isVerified: { type: Boolean, default: false },
  trustScore: { type: Number, default: 50 }, // 0-100 scale
  reliabilityRate: { type: Number, default: 100 }, // % of successful returns
  punctualityRate: { type: Number, default: 100 }, // % of on-time returns
  responseTimeSeconds: { type: Number, default: 3600 }, // Average response time
  disputeRate: { type: Number, default: 0 }, // % of transactions involving disputes
  transactionCount: { type: Number, default: 0 },
  savedItems: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Item' }],
  impactScore: { type: Number, default: 0 }
});

export const User = mongoose.model('User', userSchema);
