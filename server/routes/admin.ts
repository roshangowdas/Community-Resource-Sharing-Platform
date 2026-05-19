import express from 'express';
import { auth as authenticateToken, adminAuth as isAdmin } from '../middleware/auth';
import { User } from '../models/User';
import { Item } from '../models/Item';
import { Request } from '../models/Request';
import { Report } from '../models/Report';
import { Dispute } from '../models/Dispute';
import { Deposit } from '../models/Deposit';
import { EscrowTransaction } from '../models/EscrowTransaction';
import JSZip from 'jszip';

const router = express.Router();

// Export All Data as ZIP
router.get('/export', authenticateToken, isAdmin, async (req, res) => {
  try {
    const [users, items, requests, reports, disputes] = await Promise.all([
      User.find().lean(),
      Item.find().lean(),
      Request.find().lean(),
      Report.find().lean(),
      Dispute.find().lean()
    ]);

    const zip = new JSZip();
    const dataFolder = zip.folder("sharelocal_data_backup");
    
    if (dataFolder) {
      dataFolder.file("users.json", JSON.stringify(users, null, 2));
      dataFolder.file("items.json", JSON.stringify(items, null, 2));
      dataFolder.file("requests.json", JSON.stringify(requests, null, 2));
      dataFolder.file("reports.json", JSON.stringify(reports, null, 2));
      dataFolder.file("disputes.json", JSON.stringify(disputes, null, 2));
      dataFolder.file("metadata.json", JSON.stringify({
        exportedAt: new Date().toISOString(),
        version: "1.0.0",
        app: "ShareLocal"
      }, null, 2));

      const content = await zip.generateAsync({ type: "nodebuffer" });
      
      res.setHeader('Content-Type', 'application/zip');
      res.setHeader('Content-Disposition', 'attachment; filename=sharelocal_backup.zip');
      res.send(content);
    } else {
      throw new Error("Failed to create zip folder");
    }
  } catch (error: any) {
    console.error("Export error:", error);
    res.status(500).json({ error: 'Failed to generate backup. ' + error.message });
  }
});

// Get Admin Stats
router.get('/stats', authenticateToken, isAdmin, async (req, res) => {
  try {
    const [totalUsers, activeItems, pendingRequests, pendingReports, openDisputes] = await Promise.all([
      User.countDocuments(),
      Item.countDocuments({ status: { $ne: 'deleted' } }),
      Request.countDocuments({ status: 'pending' }),
      Report.countDocuments({ status: 'pending' }),
      Dispute.countDocuments({ status: 'open' })
    ]);
    
    res.json({
      totalUsers,
      activeItems,
      pendingRequests,
      pendingReports,
      openDisputes
    });
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch admin stats' });
  }
});

// Get User List
router.get('/users', authenticateToken, isAdmin, async (req, res) => {
  try {
    const users = await User.find().sort({ createdAt: -1 });
    res.json(users);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch users' });
  }
});

// Get All Disputes
router.get('/disputes', authenticateToken, isAdmin, async (req, res) => {
  try {
    const disputes = await Dispute.find()
      .populate({
        path: 'request',
        populate: [
          { path: 'item' },
          { path: 'owner', select: 'name email' },
          { path: 'requester', select: 'name email' }
        ]
      })
      .populate('reporter', 'name email')
      .sort({ createdAt: -1 });
    
    res.json(disputes);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch disputes' });
  }
});

// Resolve Dispute
router.post('/disputes/:id/resolve', authenticateToken, isAdmin, async (req: any, res) => {
  try {
    const { winner, ownerAmount, borrowerAmount, adminNotes } = req.body;
    const dispute = await Dispute.findById(req.params.id).populate('request');
    
    if (!dispute) return res.status(404).json({ error: 'Dispute not found' });
    
    const request = dispute.request as any;
    const deposit = await Deposit.findOne({ request: request._id });
    
    if (!deposit) return res.status(404).json({ error: 'Deposit record not found' });

    // Handle fund distribution logic based on winner
    if (winner === 'borrower') {
      deposit.status = 'refunded';
      const tx = new EscrowTransaction({
        type: 'refund',
        amount: deposit.amount,
        from: 'escrow',
        request: request._id,
        status: 'completed'
      });
      await tx.save();
    } else if (winner === 'owner') {
      deposit.status = 'compensated_to_owner';
      
      const txComp = new EscrowTransaction({
        type: 'compensation',
        amount: ownerAmount || deposit.amount,
        from: 'escrow',
        request: request._id,
        status: 'completed'
      });
      await txComp.save();

      if (borrowerAmount > 0) {
        const txRef = new EscrowTransaction({
          type: 'refund',
          amount: borrowerAmount,
          from: 'escrow',
          request: request._id,
          status: 'completed'
        });
        await txRef.save();
      }
    }

    dispute.status = 'resolved';
    dispute.resolution = {
      winner,
      ownerAmount,
      borrowerAmount,
      adminNotes,
      resolvedAt: new Date()
    };
    await dispute.save();

    request.status = 'completed';
    await request.save();
    await deposit.save();

    res.json({ success: true, dispute });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

export default router;
