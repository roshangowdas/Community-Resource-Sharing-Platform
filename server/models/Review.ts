import mongoose from 'mongoose';

const reviewSchema = new mongoose.Schema({
  request: { type: mongoose.Schema.Types.ObjectId, ref: 'Request', required: true },
  from: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  to: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  rating: { type: Number, required: true, min: 1, max: 5 },
  comment: { type: String, required: true, maxlength: 500 },
  createdAt: { type: Date, default: Date.now }
});

reviewSchema.index({ to: 1 });
reviewSchema.index({ from: 1 });
reviewSchema.index({ request: 1 });

export const Review = mongoose.model('Review', reviewSchema);
