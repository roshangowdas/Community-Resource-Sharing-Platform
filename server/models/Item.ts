import mongoose from 'mongoose';

const itemSchema = new mongoose.Schema({
  owner: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  title: { type: String, required: true },
  description: { type: String, required: true },
  category: { type: String, required: true },
  type: { type: String, enum: ['share', 'donate'], required: true },
  images: [String],
  location: { type: String, required: true },
  coordinates: {
    lat: { type: Number },
    lng: { type: Number }
  },
  locationGeo: {
    type: { type: String, enum: ['Point'], default: 'Point' },
    coordinates: { type: [Number], default: [0, 0] } // [lng, lat]
  },
  condition: { type: String, enum: ['Like New', 'Gently Used', 'Repairable', 'New'], default: 'Gently Used' },
  reservations: [{
    startDate: Date,
    endDate: Date,
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User' }
  }],
  status: { type: String, enum: ['available', 'reserved', 'borrowed', 'completed', 'deleted'], default: 'available' },
  keywords: [String],
  saveCount: { type: Number, default: 0 },
  views: { type: Number, default: 0 },
  value: { type: Number, default: 0 }, // Estimated value of the item
  depositAmount: { type: Number, default: 0 }, // Refundable deposit required
  maxBorrowDuration: { type: Number, default: 7 }, // Maximum days to borrow
  createdAt: { type: Date, default: Date.now },
  expiresAt: Date // For auto-deletion of old donations
});

// Performance indexes
itemSchema.index({ owner: 1 });
itemSchema.index({ category: 1 });
itemSchema.index({ status: 1 });
itemSchema.index({ locationGeo: '2dsphere' }); // Optimized GeoJSON index

// TTL index for automatic cleanup
itemSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

// Index for search
itemSchema.index({ title: 'text', description: 'text', keywords: 'text', category: 'text' });

export const Item = mongoose.model('Item', itemSchema);
