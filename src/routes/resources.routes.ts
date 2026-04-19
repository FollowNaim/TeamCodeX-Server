import { Router, Response } from 'express';
import { Resource } from '../models/Resource';
import { authenticate, AuthRequest } from '../middleware/authenticate';
import { authorize } from '../middleware/authorize';
import mongoose from 'mongoose';

const router = Router();
router.use(authenticate);

// GET /api/resources
router.get('/', async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const userId = new mongoose.Types.ObjectId(req.user?.id);
    const resources = await Resource.find({
      $or: [{ visibleTo: 'all' }, { visibleTo: userId }],
    }).populate('uploadedBy', 'name').sort({ createdAt: -1 });
    res.json(resources);
  } catch { res.status(500).json({ error: 'Server error' }); }
});

// POST /api/resources
router.post('/', authorize('team-lead', 'co-lead'), async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const resource = await Resource.create({ ...req.body, uploadedBy: req.user?.id });
    res.status(201).json(resource);
  } catch (err: unknown) { res.status(400).json({ error: (err as Error).message }); }
});

// PATCH /api/resources/:id
router.patch('/:id', authorize('team-lead', 'co-lead'), async (req, res: Response): Promise<void> => {
  try {
    const resource = await Resource.findByIdAndUpdate(req.params.id, req.body, { new: true });
    res.json(resource);
  } catch { res.status(500).json({ error: 'Server error' }); }
});

// DELETE /api/resources/:id
router.delete('/:id', authorize('team-lead', 'co-lead'), async (req, res: Response): Promise<void> => {
  try {
    await Resource.findByIdAndDelete(req.params.id);
    res.json({ message: 'Resource deleted' });
  } catch { res.status(500).json({ error: 'Server error' }); }
});

export default router;
