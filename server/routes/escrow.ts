import express from 'express';
import mongoose from 'mongoose';
import { auth, requireMongoUser } from '../middleware/auth';
import { Request } from '../models/Request';
import { User } from '../models/User';
import { Deposit } from '../models/Deposit';
import { EscrowTransaction } from '../models/EscrowTransaction';
import { Dispute } from '../models/Dispute';
import { createNotification } from '../lib/notifications';
import { getDepositMultiplier } from '../lib/trust';
import { v4 as uuidv4 } from 'uuid';

const router = express.Router();

// Get personal transaction history
router.get('/transactions', auth, requireMongoUser, async (req: any, res) => {
  try {
    if (mongoose.connection.readyState !== 1) return res.json([]);
    const transactions = await EscrowTransaction.find({ 
      $or: [{ from: req.user.userId }, { to: req.user.userId }] 
    })
    .populate('request')
    .sort({ createdAt: -1 })
    .lean();
    
    res.json(transactions || []);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Calculate recommended deposit
router.get('/calculate-deposit/:requestId', auth, requireMongoUser, async (req: any, res) => {
  try {
    if (!mongoose.Types.ObjectId.isValid(req.params.requestId)) {
      return res.status(400).json({ error: 'Invalid request ID' });
    }
    const request = await Request.findById(req.params.requestId).populate('item');
    if (!request) return res.status(404).json({ error: 'Request not found' });
    
    const item = request.item as any;
    const itemValue = item.value || 0;
    const baseDeposit = item.depositAmount || 0;
    
    // Dynamic adjustment
    const multiplier = await getDepositMultiplier(req.user.userId);
    const dynamicDeposit = Math.round(baseDeposit * multiplier);
    
    // Insurance calculation (e.g. 5% of item value, min $2)
    const insuranceFee = Math.max(2, Math.round(itemValue * 0.05));

    res.json({ 
      baseDeposit,
      dynamicDeposit,
      multiplier,
      insuranceFee,
      totalToPay: dynamicDeposit + insuranceFee
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Process simulated escrow deposit (replacing Stripe)
router.post('/confirm-escrow', auth, requireMongoUser, async (req: any, res) => {
  try {
    const { requestId, useInsurance } = req.body;
    if (!requestId || !mongoose.Types.ObjectId.isValid(requestId)) {
      return res.status(400).json({ error: 'Invalid or missing request ID' });
    }
    const request = await Request.findById(requestId).populate('item owner');
    
    if (!request) return res.status(404).json({ error: 'Request not found' });
    if (request.status !== 'approved') {
      return res.status(400).json({ error: 'Contract must be approved before initiating escrow' });
    }
    if (request.requester.toString() !== req.user.userId) {
      return res.status(403).json({ error: 'Unauthorized' });
    }

    const item = request.item as any;
    const multiplier = await getDepositMultiplier(req.user.userId);
    const depositAmount = Math.round((item.depositAmount || 0) * multiplier);
    const insuranceFee = useInsurance ? Math.max(2, Math.round((item.value || 0) * 0.05)) : 0;

    // Create deposit record
    const deposit = new Deposit({
      request: requestId,
      item: item._id,
      depositor: req.user.userId,
      amount: depositAmount,
      status: 'escrowed'
    });

    // Create transaction log
    const transaction = new EscrowTransaction({
      type: 'deposit',
      amount: depositAmount + insuranceFee,
      from: req.user.userId,
      request: requestId,
      status: 'completed'
    });

    await deposit.save();
    await transaction.save();

    // Generate Dual Handover QR tokens
    const borrowerHandoverToken = `BHO-${uuidv4().substring(0, 8).toUpperCase()}`;
    const ownerHandoverToken = `OHO-${uuidv4().substring(0, 8).toUpperCase()}`;

    // Update request status
    request.status = 'deposit_paid';
    request.depositAmount = depositAmount;
    request.insuranceFee = insuranceFee;
    request.insuranceCovered = useInsurance;
    request.borrowerHandoverToken = borrowerHandoverToken;
    request.ownerHandoverToken = ownerHandoverToken;
    await request.save();

    if ((res as any).locals.io) {
      (res as any).locals.io.to(request._id.toString()).emit('request_updated', request);
    }

    // Notify owner
    await createNotification((res as any).locals.io, {
      recipient: request.owner.toString(),
      sender: req.user.userId,
      type: 'deposit_paid',
      title: 'Ledger Secured',
      message: `The security deposit for ${item.title} has been committed to the neighborhood ledger. Handover protocol initialized.`,
      link: `/messages?id=${request._id}`,
      relatedId: request._id.toString()
    });

    res.json({ success: true, status: 'deposit_paid' });
  } catch (error: any) {
    console.error('Escrow Error:', error);
    res.status(500).json({ error: error.message });
  }
});

// Raise a dispute
router.post('/dispute', auth, requireMongoUser, async (req: any, res) => {
  try {
    const { requestId, reason, description, evidenceImages } = req.body;
    if (!requestId || !mongoose.Types.ObjectId.isValid(requestId)) {
      return res.status(400).json({ error: 'Invalid or missing request ID' });
    }
    const request = await Request.findById(requestId);
    
    if (!request) return res.status(404).json({ error: 'Request not found' });
    
    // Either owner or borrower can dispute
    if (request.owner.toString() !== req.user.userId && request.requester.toString() !== req.user.userId) {
      return res.status(403).json({ error: 'Unauthorized' });
    }

    const dispute = new Dispute({
      request: requestId,
      reporter: req.user.userId,
      reason,
      description,
      evidenceImages,
      status: 'open'
    });

    await dispute.save();

    request.status = 'disputed';
    await request.save();

    // Notify other party
    const recipient = request.owner.toString() === req.user.userId ? request.requester : request.owner;
    await createNotification((res as any).locals.io, {
      recipient: recipient.toString(),
      sender: req.user.userId,
      type: 'dispute_raised',
      title: 'Dispute Raised',
      message: `A dispute has been raised regarding your transaction. Our admins will review this soon.`,
      link: `/profile?tab=activity`,
      relatedId: request._id.toString()
    });

    res.json(dispute);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

export default router;
