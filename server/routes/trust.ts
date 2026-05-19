import express from 'express';
import mongoose from 'mongoose';
import { auth } from '../middleware/auth';
import { calculateTrustScore } from '../lib/trust';
import { User } from '../models/User';

const router = express.Router();

router.get('/my-reputation', auth, async (req: any, res) => {
  try {
    if (mongoose.connection.readyState !== 1) {
      return res.json({ trustScore: 40, reliabilityRate: 100, transactionCount: 0, isVerified: false });
    }
    const userId = req.user.userId;
    const user = await User.findById(userId);
    if (!user) return res.status(404).json({ error: 'User not found' });

    const trustScore = await calculateTrustScore(userId);
    
    res.json({
      trustScore,
      reliabilityRate: user.reliabilityRate || 100,
      punctualityRate: user.punctualityRate || 100,
      disputeRate: user.disputeRate || 0,
      transactionCount: user.transactionCount || 0,
      isVerified: user.isVerified
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

router.get('/user/:id', async (req, res) => {
  try {
    if (mongoose.connection.readyState !== 1) {
      return res.status(503).json({ error: "Service temporarily unavailable", details: "Neural link offline" });
    }
    const user = await User.findById(req.params.id).select('name avatar trustScore reliabilityRate transactionCount isVerified');
    if (!user) return res.status(404).json({ error: 'User not found' });
    
    // Refresh trust score
    const trustScore = await calculateTrustScore(user._id.toString());
    
    res.json({
      _id: user._id,
      name: user.name,
      avatar: user.avatar,
      trustScore,
      reliabilityRate: user.reliabilityRate,
      transactionCount: user.transactionCount,
      isVerified: user.isVerified
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

export default router;
