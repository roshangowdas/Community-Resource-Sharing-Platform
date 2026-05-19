import express from 'express';
import mongoose from 'mongoose';
import { Message } from '../models/Message';
import { Request } from '../models/Request';
import { auth, requireMongoUser } from '../middleware/auth';

const router = express.Router();

// Get messages for a request
router.get('/:requestId', auth, requireMongoUser, async (req: any, res) => {
  try {
    if (mongoose.connection.readyState !== 1) return res.json([]);
    if (!mongoose.Types.ObjectId.isValid(req.params.requestId)) {
      return res.status(400).json({ error: 'Invalid request ID' });
    }
    const request = await Request.findById(req.params.requestId).lean();
    if (!request) return res.status(404).json({ error: 'Request not found' });

    // Ensure user is requester or owner
    if (request.requester.toString() !== req.user.userId && request.owner.toString() !== req.user.userId) {
      return res.status(403).json({ error: 'Unauthorized to view these messages' });
    }

    // Secure Chat: Check if request is approved or pending
    const openStatuses = ['pending', 'approved', 'deposit_paid', 'item_handed_over', 'borrowed', 'return_requested', 'returned', 'completed', 'disputed'];
    if (!openStatuses.includes(request.status)) {
       return res.status(403).json({ error: 'Chat is locked for this request status' });
    }

    const messages = await Message.find({ request: req.params.requestId })
      .sort({ createdAt: 1 })
      .populate('sender', 'name avatar')
      .lean();
    
    res.json(messages);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Send a message
router.post('/', auth, requireMongoUser, async (req: any, res) => {
  try {
    const { requestId, text } = req.body;
    if (!requestId || !mongoose.Types.ObjectId.isValid(requestId)) {
      return res.status(400).json({ error: 'Invalid or missing request ID' });
    }
    const request = await Request.findById(requestId);
    
    if (!request) return res.status(404).json({ error: 'Request not found' });

    // Ensure user is part of the request
    if (request.requester.toString() !== req.user.userId && request.owner.toString() !== req.user.userId) {
      return res.status(403).json({ error: 'Unauthorized' });
    }

    // Secure Chat logic
    const openStatuses = ['pending', 'approved', 'deposit_paid', 'item_handed_over', 'borrowed', 'return_requested', 'returned', 'completed', 'disputed'];
    if (!openStatuses.includes(request.status)) {
      return res.status(403).json({ error: 'Chat is locked for this request status' });
    }

    const message = new Message({
      request: requestId,
      sender: req.user.userId,
      text
    });

    await message.save();
    res.status(201).json(message);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

export default router;
