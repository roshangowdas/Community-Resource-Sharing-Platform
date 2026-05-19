import express from 'express';
import mongoose from 'mongoose';
import { v4 as uuidv4 } from 'uuid';
import QRCode from 'qrcode';
import { Request as RequestModel } from '../models/Request';
import { Item } from '../models/Item';
import { auth, requireMongoUser } from '../middleware/auth';
import { createNotification } from '../lib/notifications';
import { User } from '../models/User';
import { Message } from '../models/Message';

const router = express.Router();

const createSystemMessage = async (io: any, requestId: string, text: string) => {
  try {
    const message = new Message({
      request: requestId,
      sender: null, // System message
      text,
      isSystem: true
    });
    await message.save();
    if (io) {
      io.to(requestId).emit('receive_message', message);
    }
  } catch (err) {
    console.error('System Message Error:', err);
  }
};

// Create a request
router.post('/', auth, requireMongoUser, async (req: any, res) => {
  try {
    const { itemId, message, borrowStartDate, borrowEndDate } = req.body;
    const item = await Item.findById(itemId).populate('owner', 'firebaseUid').maxTimeMS(5000);
    
    if (!item) return res.status(404).json({ error: 'Item not found' });
    if (item.owner._id.toString() === req.user.userId) {
      return res.status(400).json({ error: 'You cannot request your own item' });
    }

    // If dates are provided, check for overlaps
    if (borrowStartDate && borrowEndDate) {
      const start = new Date(borrowStartDate);
      const end = new Date(borrowEndDate);
      const overlap = item.reservations.some((res: any) => {
        const resStart = new Date(res.startDate);
        const resEnd = new Date(res.endDate);
        return (start < resEnd && end > resStart);
      });
      if (overlap) return res.status(400).json({ error: 'Selected time slot is already occupied.' });
    }

    // Check if request already exists
    const existing = await RequestModel.findOne({ 
      item: itemId, 
      requester: req.user.userId, 
      status: { $in: ['pending', 'approved', 'deposit_paid', 'item_handed_over', 'borrowed'] } 
    });
    if (existing) return res.status(400).json({ error: 'You already have an active request for this item.' });

    const request = new RequestModel({
      item: itemId,
      requester: req.user.userId,
      owner: item.owner._id,
      message,
      borrowStartDate: borrowStartDate ? new Date(borrowStartDate) : undefined,
      borrowEndDate: borrowEndDate ? new Date(borrowEndDate) : undefined,
      status: 'pending'
    });

    await request.save();
    
    // Create initial message in chat
    const { Message } = await import('../models/Message');
    const initialMessage = new Message({
      request: request._id,
      sender: req.user.userId,
      text: message || `Hi! I'm interested in borrowing ${item.title}.`
    });
    await initialMessage.save();
    
    // Notify owner
    const requester = await User.findById(req.user.userId);
    const ownerFirebaseUid = (item.owner as any).firebaseUid;
    const notification = {
      recipient: item.owner._id.toString(),
      sender: req.user.userId,
      type: 'request_created',
      title: 'New Resource Request',
      message: `${requester?.name || 'A neighbor'} wants to borrow ${item.title}.`,
      link: `/messages?id=${request._id}`,
      relatedId: request._id.toString()
    };
    await createNotification((res as any).locals.io, notification);

    if ((res as any).locals.io) {
      const populatedForEmit = await request.populate([
        { path: 'item' },
        { path: 'requester', select: 'name avatar firebaseUid' },
        { path: 'owner', select: 'name avatar firebaseUid' }
      ]);
      
      // Emit to the owner specifically to refresh their list - using firebaseUid for stable room targeting
      (res as any).locals.io.to(`user_${ownerFirebaseUid}`).emit('new_incoming_request', populatedForEmit);
      
      (res as any).locals.io.to(request._id.toString()).emit('receive_message', await initialMessage.populate('sender', 'name avatar'));
    }

    res.status(201).json(request);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Get requests sent by user
router.get('/me', auth, requireMongoUser, async (req: any, res) => {
  try {
    if (mongoose.connection.readyState !== 1) return res.json([]);
    const requests = await RequestModel.find({ requester: req.user.userId })
      .populate('item')
      .populate('owner', 'name avatar')
      .sort({ createdAt: -1 })
      .maxTimeMS(8000)
      .lean();
    res.json(requests);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Get requests received as owner
router.get('/incoming', auth, requireMongoUser, async (req: any, res) => {
  try {
    if (mongoose.connection.readyState !== 1) return res.json([]);
    const requests = await RequestModel.find({ owner: req.user.userId })
      .populate('item')
      .populate('requester', 'name avatar')
      .sort({ createdAt: -1 })
      .maxTimeMS(8000)
      .lean();
    res.json(requests);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Update request status (approve/reject)
router.patch('/:id/status', auth, requireMongoUser, async (req: any, res) => {
  try {
    if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
      return res.status(400).json({ error: 'Invalid request ID' });
    }
    const { status } = req.body;
    if (!['approved', 'rejected', 'completed'].includes(status)) {
      return res.status(400).json({ error: 'Invalid status' });
    }

    const request = await RequestModel.findById(req.params.id);
    if (!request) return res.status(404).json({ error: 'Request not found' });

    const item = await Item.findById(request.item);
    if (!item) return res.status(404).json({ error: 'Item not found' });

    // Only owner can approve/reject
    if (request.owner.toString() !== req.user.userId.toString()) {
      return res.status(403).json({ error: 'Unauthorized' });
    }

    request.status = status;
    request.updatedAt = new Date();

    // If approved, generate handover tokens immediately for the pickup flow
    if (status === 'approved') {
      request.borrowerHandoverToken = `BHO-${uuidv4().substring(0, 8).toUpperCase()}`;
      request.ownerHandoverToken = `OHO-${uuidv4().substring(0, 8).toUpperCase()}`;
      
      // If it's a donation, we might want a different intermediate status if needed, 
      // but 'approved' works as "Ready for Pickup"
    }

    await request.save();
    
    if ((res as any).locals.io) {
      const populatedForEmit = await request.populate([
        { path: 'item' },
        { path: 'requester', select: 'name avatar firebaseUid' },
        { path: 'owner', select: 'name avatar firebaseUid' }
      ]);
      const room = request._id.toString();
      const ownerFirebaseUid = (populatedForEmit.owner as any).firebaseUid;
      const requesterFirebaseUid = (populatedForEmit.requester as any).firebaseUid;

      (res as any).locals.io.to(room).emit('request_updated', populatedForEmit);
      if (ownerFirebaseUid) (res as any).locals.io.to(`user_${ownerFirebaseUid}`).emit('request_updated', populatedForEmit);
      if (requesterFirebaseUid) (res as any).locals.io.to(`user_${requesterFirebaseUid}`).emit('request_updated', populatedForEmit);
      
      await createSystemMessage((res as any).locals.io, room, `Resource management state updated to: ${status.toUpperCase()}`);
    }
    if (status === 'completed' && request.returnVerifiedAt) {
       const { triggerEscrowRefund } = await import('../lib/escrow');
       await triggerEscrowRefund(request._id.toString(), (res as any).locals.io);
    }

    // Sync item status if necessary
    if (item) {
      if (status === 'approved') {
        item.status = 'reserved';
      } else if (status === 'completed') {
        item.status = item.type === 'donate' ? 'completed' : 'available';
      } else if (status === 'rejected') {
        // If rejected, ensure it stays available (though it might already be)
        item.status = 'available'; 
      }
      await item.save();
      
      // Emit update event
      const populatedItem = await item.populate('owner', 'name avatar rating impactScore reviewCount');
      if ((res as any).locals.io) {
        (res as any).locals.io.emit('item_updated', populatedItem);
      }
    }

    // Notify requester about status change
    const populatedRequest = await request.populate('item');
    if (!populatedRequest.item) {
      return res.json(request);
    }
    const itemTitle = (populatedRequest.item as any)?.title || 'resource';
    
    let notifType = 'request_approved';
    let title = 'Request Approved!';
    let message = `Your request for ${itemTitle} has been approved. You can now chat with the owner.`;

    if (status === 'rejected') {
      notifType = 'request_rejected';
      title = 'Request Declined';
      message = `Your request for ${itemTitle} was declined.`;
    } else if (status === 'completed') {
      notifType = 'request_completed';
      title = 'Lending Completed';
      message = `The session for ${itemTitle} has been marked as completed. Please leave a review!`;
    }

    await createNotification((res as any).locals.io, {
      recipient: request.requester.toString(),
      sender: req.user.userId,
      type: notifType,
      title: title,
      message: message,
      link: status === 'approved' ? `/messages?id=${request._id}` : '/profile?tab=activity',
      relatedId: request._id.toString()
    });

    res.json(request);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Verify handover token (called by both owner and borrower)
router.post('/:id/verify-handover', auth, requireMongoUser, async (req: any, res) => {
  try {
    if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
      return res.status(400).json({ error: 'Invalid request ID' });
    }
    const { token } = req.body;
    const request = await RequestModel.findById(req.params.id).populate('item');
    if (!request) return res.status(404).json({ error: 'Request not found' });
    
    let isOwner = request.owner.toString() === req.user.userId;
    let isBorrower = request.requester.toString() === req.user.userId;

    if (!isOwner && !isBorrower) return res.status(403).json({ error: 'Unauthorized' });

    // Logic:
    // Receiver (Borrower) shows their token to the Seller (Owner).
    // The Owner scans it and calls this API.
    
    if (isOwner) {
      if (request.borrowerHandoverToken !== token) {
        return res.status(400).json({ error: 'Invalid Handover token provided.' });
      }
      request.borrowerHandoverVerified = true;
      request.ownerHandoverVerified = true; // Auto-verify owner side if they scan effectively
    } else {
      // Borrower scanning owner code (alternative flow)
      if (request.ownerHandoverToken !== token) {
        return res.status(400).json({ error: 'Invalid Owner token provided.' });
      }
      request.ownerHandoverVerified = true;
      request.borrowerHandoverVerified = true;
    }

    // Since we auto-verified both for a scan match:
    const isDonation = (request.item as any).type === 'donate';
    const depositAmount = (request.item as any).depositAmount || 0;
    
    if (isDonation) {
      // Path B: Free Donation
      request.status = 'completed';
      request.handoverVerifiedAt = new Date();
      request.actualReturnDate = new Date();
    } else {
      // Path A: Rent / Lend
      request.status = 'borrowed'; // Immediately move to borrowed after scan + verification
      request.handoverVerifiedAt = new Date();
      request.borrowStartDate = new Date();

      // Trigger Security Deposit Hold (Escrow) if required
      if (depositAmount > 0) {
        const { Deposit } = await import('../models/Deposit');
        const { EscrowTransaction } = await import('../models/EscrowTransaction');
        
        const deposit = new Deposit({
          request: request._id,
          item: request.item._id,
          depositor: request.requester,
          amount: depositAmount,
          status: 'escrowed'
        });
        await deposit.save();

        const transaction = new EscrowTransaction({
          type: 'deposit',
          amount: depositAmount,
          from: request.requester,
          request: request._id,
          status: 'completed'
        });
        await transaction.save();
      }
      
      // Generate Return QR token for later
      const returnToken = `RET-${uuidv4().substring(0, 8).toUpperCase()}`;
      request.returnQRCode = returnToken;
      request.returnQRDataURL = await QRCode.toDataURL(returnToken);

      const duration = (request.item as any).maxBorrowDuration || 7;
      const endDate = new Date();
      endDate.setDate(endDate.getDate() + duration);
      request.borrowEndDate = endDate;
    }
    
    const item = await Item.findById(request.item);
    if (item) {
      item.status = isDonation ? 'completed' : 'borrowed';
      await item.save();
      if ((res as any).locals.io) (res as any).locals.io.emit('item_updated', item);
    }

    const recipient = isOwner ? request.requester : request.owner;
    await createNotification((res as any).locals.io, {
      recipient: recipient.toString(),
      sender: req.user.userId,
      type: isDonation ? 'request_completed' : 'request_approved',
      title: isDonation ? 'Donation Complete!' : 'Handover Complete!',
      message: `${isDonation ? 'Resource' : 'Item'} successfully transferred via grid verification.`,
      link: `/messages?id=${request._id}`,
      relatedId: request._id.toString()
    });

    await request.save();
    
    if ((res as any).locals.io) {
      (res as any).locals.io.to(request._id.toString()).emit('request_updated', request);
      const isDonation = (request.item as any).type === 'donate';
      await createSystemMessage((res as any).locals.io, request._id.toString(), isDonation ? "Donation verification complete." : "Handover verification complete. Borrowing period has started.");
    }
    res.json(request);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Mark item as returned and upload proof
router.post('/:id/return-request', auth, requireMongoUser, async (req: any, res) => {
  try {
    if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
      return res.status(400).json({ error: 'Invalid request ID' });
    }
    const { proofMedia } = req.body;
    const request = await RequestModel.findById(req.params.id);
    if (!request) return res.status(404).json({ error: 'Request not found' });
    if (request.requester.toString() !== req.user.userId) return res.status(403).json({ error: 'Unauthorized' });

    request.status = 'return_requested';
    request.returnProofMedia = proofMedia || [];

    // Ensure QR code exists
    if (!request.returnQRCode) {
      request.returnQRCode = `RET-${uuidv4().substring(0, 8).toUpperCase()}`;
    }
    if (!request.returnQRDataURL) {
      request.returnQRDataURL = await QRCode.toDataURL(request.returnQRCode);
    }

    // Trigger AI condition check
    const { analyzeItemCondition } = await import('../lib/aiCondition');
    request.returnConditionReport = await analyzeItemCondition(request._id.toString(), 'return', proofMedia || []);

    await request.save();

    if ((res as any).locals.io) {
      (res as any).locals.io.to(request._id.toString()).emit('request_updated', request);
      await createSystemMessage((res as any).locals.io, request._id.toString(), "Return requested by borrower.");
    }

    await createNotification((res as any).locals.io, {
      recipient: request.owner.toString(),
      sender: req.user.userId,
      type: 'system',
      title: 'Return QR Active',
      message: 'The borrower is ready to return the item. Scan their QR code to finalize the return.',
      link: `/messages?id=${request._id}`,
      relatedId: request._id.toString()
    });

    res.json(request);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Finalize return with QR verification
router.post('/:id/verify-return', auth, requireMongoUser, async (req: any, res) => {
  try {
    if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
      return res.status(400).json({ error: 'Invalid request ID' });
    }
    const { qrCode } = req.body;
    const { Deposit } = await import('../models/Deposit');
    const { EscrowTransaction } = await import('../models/EscrowTransaction');

    const request = await RequestModel.findById(req.params.id).populate('item');
    if (!request) return res.status(404).json({ error: 'Request not found' });
    if (request.owner.toString() !== req.user.userId) return res.status(403).json({ error: 'Unauthorized' });

    // QR Check
    if (request.returnQRCode !== qrCode) {
      return res.status(400).json({ error: 'Invalid return QR code. Verification failed.' });
    }

    // AI comparison check
    const { compareConditions } = await import('../lib/aiCondition');
    await compareConditions(request._id.toString());

    request.status = 'completed';
    request.actualReturnDate = new Date();
    request.returnVerifiedAt = new Date();
    await request.save();

    if ((res as any).locals.io) {
      (res as any).locals.io.to(request._id.toString()).emit('request_updated', request);
      await createSystemMessage((res as any).locals.io, request._id.toString(), "Return verified by owner. Transaction completed.");
    }

    // Reset item status
    const item = await Item.findById(request.item);
    if (item) {
      item.status = 'available';
      await item.save();
      if ((res as any).locals.io) {
        (res as any).locals.io.emit('item_updated', item);
      }
    }

    // Process refund automatically via helper
    const { triggerEscrowRefund } = await import('../lib/escrow');
    await triggerEscrowRefund(request._id.toString(), (res as any).locals.io);

    res.json(request);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

export default router;
