import express from 'express';
import mongoose from 'mongoose';
import { Notification } from '../models/Notification';
import { auth } from '../middleware/auth';

const router = express.Router();

// Get all notifications for the current user
router.get('/', auth, async (req: any, res) => {
  try {
    if (mongoose.connection.readyState !== 1) return res.json([]);
    const notifications = await Notification.find({ recipient: req.user.userId })
      .sort({ createdAt: -1 })
      .limit(50)
      .populate('sender', 'name avatar');
    res.json(notifications);
  } catch (error) {
    res.status(500).json({ error: "Failed to fetch notifications" });
  }
});

// Mark a notification as read
router.patch('/:id/read', auth, async (req: any, res) => {
  try {
    const notification = await Notification.findOneAndUpdate(
      { _id: req.params.id, recipient: req.user.userId },
      { read: true },
      { new: true }
    );
    if (!notification) return res.status(404).json({ error: "Notification not found" });
    res.json(notification);
  } catch (error) {
    res.status(500).json({ error: "Failed to update notification" });
  }
});

// Mark all notifications as read
router.patch('/read-all', auth, async (req: any, res) => {
  try {
    await Notification.updateMany(
      { recipient: req.user.userId, read: false },
      { read: true }
    );
    res.json({ message: "All notifications marked as read" });
  } catch (error) {
    res.status(500).json({ error: "Failed to update notifications" });
  }
});

// Delete a notification
router.delete('/:id', auth, async (req: any, res) => {
  try {
    const notification = await Notification.findOneAndDelete({
      _id: req.params.id,
      recipient: req.user.userId
    });
    if (!notification) return res.status(404).json({ error: "Notification not found" });
    res.json({ message: "Notification deleted" });
  } catch (error) {
    res.status(500).json({ error: "Failed to delete notification" });
  }
});

export default router;
