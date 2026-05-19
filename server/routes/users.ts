import express from 'express';
import mongoose from 'mongoose';
import { User } from '../models/User';
import { auth, requireMongoUser } from '../middleware/auth';
import { dbStatus } from '../../server';

const router = express.Router();

// Get current user profile (more details than just what's in JWT)
router.get('/profile', auth, async (req: any, res) => {
  try {
    // If DB is connecting, wait a bit
    if (mongoose.connection.readyState === 2) {
      let attempts = 0;
      while (mongoose.connection.readyState === 2 && attempts < 30) {
        await new Promise(resolve => setTimeout(resolve, 1000));
        attempts++;
      }
    }

    if (mongoose.connection.readyState !== 1) {
      const isAuthError = dbStatus.lastError?.toLowerCase().includes('auth') || 
                         dbStatus.lastError?.toLowerCase().includes('password') ||
                         dbStatus.lastError?.includes('code 18');
                         
      return res.json({
        _id: req.user.userId,
        name: req.user.name,
        email: req.user.email,
        avatar: req.user.avatar,
        trustScore: 40,
        impactScore: 0,
        isTemporary: true,
        status: mongoose.connection.readyState === 2 ? 'connecting' : 'maintenance',
        isAuthError
      });
    }

    const user = await User.findById(req.user.userId).select('-password').maxTimeMS(3000);
    
    if (!user) {
      return res.json({
        _id: req.user.userId,
        name: req.user.name,
        email: req.user.email,
        avatar: req.user.avatar,
        trustScore: 40,
        impactScore: 0,
        isTemporary: true
      });
    }

    res.json(user);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Update profile
router.patch('/profile', auth, requireMongoUser, async (req: any, res) => {
  try {
    const { name, avatar, bio, location } = req.body;
    
    const updates: any = {};
    if (name !== undefined) updates.name = name;
    if (avatar !== undefined) updates.avatar = avatar;
    if (bio !== undefined) updates.bio = bio;
    if (location !== undefined) updates.location = location;

    const user = await User.findByIdAndUpdate(
      req.user.userId,
      { $set: updates },
      { new: true, runValidators: true }
    ).select('-password');

    if (!user) return res.status(404).json({ error: 'User not found' });
    
    res.json(user);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

export default router;
