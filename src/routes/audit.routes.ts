import { Router, Response } from 'express';
import { AuditLog } from '../models/AuditLog';
import { authenticate } from '../middleware/authenticate';
import { authorize } from '../middleware/authorize';

const router = Router();
router.use(authenticate, authorize('team-lead', 'co-lead'));

router.get('/', async (req, res: Response): Promise<void> => {
  try {
    const page = Number(req.query.page) || 1;
    const limit = Number(req.query.limit) || 50;
    const logs = await AuditLog.find()
      .populate('userId', 'name email')
      .sort({ timestamp: -1 })
      .skip((page - 1) * limit)
      .limit(limit);
    const total = await AuditLog.countDocuments();
    res.json({ logs, total, page, pages: Math.ceil(total / limit) });
  } catch { res.status(500).json({ error: 'Server error' }); }
});

router.get('/:resourceId', async (req, res: Response): Promise<void> => {
  try {
    const logs = await AuditLog.find({ resourceId: req.params.resourceId })
      .populate('userId', 'name email')
      .sort({ timestamp: -1 });
    res.json(logs);
  } catch { res.status(500).json({ error: 'Server error' }); }
});

export default router;
