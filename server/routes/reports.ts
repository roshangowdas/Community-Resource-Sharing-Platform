import express from 'express';
import { auth as authenticateToken, adminAuth as isAdmin } from '../middleware/auth';
import { Report } from '../models/Report';
import { Item } from '../models/Item';
import { User } from '../models/User';
import { Notification } from '../models/Notification';

const router = express.Router();

// Submit a report
router.post('/', authenticateToken, async (req: any, res) => {
  try {
    const { targetType, targetId, reason, description } = req.body;
    
    const report = new Report({
      reporter: req.user.userId,
      targetType,
      targetId,
      reason,
      description
    });
    
    await report.save();
    res.status(201).json(report);
  } catch (error) {
    res.status(500).json({ error: 'Failed to submit report' });
  }
});

// Admin: Get all reports
router.get('/admin', authenticateToken, isAdmin, async (req, res) => {
  try {
    const reports = await Report.find()
      .populate('reporter', 'name email')
      .sort({ createdAt: -1 });
      
    // Manually populate targets based on type
    const populatedReports = await Promise.all(reports.map(async (report: any) => {
      let targetData = null;
      if (report.targetType === 'item') {
        targetData = await Item.findById(report.targetId).select('title images status');
      } else if (report.targetType === 'user') {
        targetData = await User.findById(report.targetId).select('name email avatar');
      }
      return { ...report.toObject(), targetData };
    }));
    
    res.json(populatedReports);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch reports' });
  }
});

// Admin: Resolve report
router.patch('/:id/resolve', authenticateToken, isAdmin, async (req, res) => {
  try {
    const { action } = req.body; // 'delete', 'ban', 'dismiss'
    const report: any = await Report.findById(req.params.id);
    
    if (!report) return res.status(404).json({ error: 'Report not found' });

    if (action === 'delete' && report.targetType === 'item') {
      await Item.findByIdAndDelete(report.targetId);
    } else if (action === 'ban' && report.targetType === 'user') {
       // Placeholder for banning logic
    }

    report.status = action === 'dismiss' ? 'dismissed' : 'resolved';
    await report.save();
    
    res.json(report);
  } catch (error) {
    res.status(500).json({ error: 'Failed to resolve report' });
  }
});

export default router;
