import express from 'express';
import mongoose from 'mongoose';
import { Review } from '../models/Review';
import { Request } from '../models/Request';
import { User } from '../models/User';
import { auth } from '../middleware/auth';
import { createNotification } from '../lib/notifications';

const router = express.Router();

// Submit a review
router.post('/', auth, async (req: any, res) => {
  try {
    const { requestId, rating, comment } = req.body;
    const request = await Request.findById(requestId);
    
    if (!request) return res.status(404).json({ error: 'Request not found' });
    if (request.status !== 'completed' && request.status !== 'approved') {
      return res.status(400).json({ error: 'Transaction must be approved or completed before reviewing' });
    }

    // Determine who is being reviewed (the other party)
    const toId = request.owner.toString() === req.user.userId ? request.requester : request.owner;

    // Check if user already reviewed this request
    const existing = await Review.findOne({ request: requestId, from: req.user.userId });
    if (existing) return res.status(400).json({ error: 'You have already reviewed this transaction' });

    const review = new Review({
      request: requestId,
      from: req.user.userId,
      to: toId,
      rating,
      comment
    });

    await review.save();

    // Update target user's rating
    const targetUser = await User.findById(toId);
    const reviewer = await User.findById(req.user.userId);
    
    if (targetUser) {
      const allReviews = await Review.find({ to: toId });
      const avgRating = allReviews.reduce((acc, r) => acc + r.rating, 0) / allReviews.length;
      targetUser.rating = parseFloat(avgRating.toFixed(1));
      targetUser.reviewCount = allReviews.length;
      await targetUser.save();

      // Notify target user
      await createNotification((res as any).locals.io, {
        recipient: toId.toString(),
        sender: req.user.userId,
        type: 'system',
        title: 'New Review Received',
        message: `${reviewer?.name || 'A neighbor'} left you a ${rating}-star review.`,
        link: '/profile'
      });
    }

    res.status(201).json(review);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Get reviews for a user
router.get('/user/:userId', async (req, res) => {
  try {
    let targetUserId = req.params.userId;
    
    // Safety check for common invalid patterns
    if (!targetUserId || targetUserId === 'undefined' || targetUserId === 'null') {
      return res.json([]);
    }

    // If it's not a valid MongoDB ID, it might be a Firebase UID
    if (!mongoose.Types.ObjectId.isValid(targetUserId)) {
      try {
        const user = await User.findOne({ firebaseUid: targetUserId }).maxTimeMS(2000);
        if (user) {
          targetUserId = user._id.toString();
        } else {
          console.warn('[Reviews] Target user not found for ID:', targetUserId);
          return res.json([]);
        }
      } catch (dbErr) {
        console.error('[Reviews] DB Lookup for user failed:', dbErr);
        return res.json([]);
      }
    }

    // Final safety check to prevent CastErrors
    if (!mongoose.Types.ObjectId.isValid(targetUserId)) {
      console.warn('[Reviews] Internal cast failure for ID:', targetUserId);
      return res.json([]);
    }

    const reviews = await Review.find({ to: new mongoose.Types.ObjectId(targetUserId) })
      .populate('from', 'name avatar')
      .sort({ createdAt: -1 })
      .lean();
    res.json(reviews);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

export default router;
