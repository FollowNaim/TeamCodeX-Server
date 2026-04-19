import { Router, Response } from 'express';
import { Review } from '../models/Review';
import { authenticate, AuthRequest } from '../middleware/authenticate';
import { authorize } from '../middleware/authorize';

const router = Router();
router.use(authenticate);

// GET /api/reviews
router.get('/', async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const isLead = req.user?.role === 'team-lead' || req.user?.role === 'co-lead';
    const filter = isLead ? {} : { submittedBy: req.user?.id };
    const reviews = await Review.find(filter)
      .populate('clientId', 'name')
      .populate('projectId', 'title')
      .populate('submittedBy', 'name avatar')
      .sort({ createdAt: -1 });
    res.json(reviews);
  } catch { res.status(500).json({ error: 'Server error' }); }
});

// GET /api/reviews/public
router.get('/public', async (_req, res: Response): Promise<void> => {
  try {
    const reviews = await Review.find({ status: 'approved' })
      .populate('clientId', 'name')
      .populate('submittedBy', 'name avatar')
      .sort({ createdAt: -1 });
    res.json(reviews);
  } catch { res.status(500).json({ error: 'Server error' }); }
});

// POST /api/reviews
router.post('/', async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const review = await Review.create({ ...req.body, submittedBy: req.user?.id });
    res.status(201).json(review);
  } catch (err: unknown) { res.status(400).json({ error: (err as Error).message }); }
});

// PATCH /api/reviews/:id/approve
router.patch('/:id/approve', authorize('team-lead', 'co-lead'), async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const review = await Review.findByIdAndUpdate(
      req.params.id,
      { status: 'approved', approvedBy: req.user?.id, approvedAt: new Date() },
      { new: true }
    );
    res.json(review);
  } catch { res.status(500).json({ error: 'Server error' }); }
});

// PATCH /api/reviews/:id/reject
router.patch('/:id/reject', authorize('team-lead', 'co-lead'), async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const review = await Review.findByIdAndUpdate(req.params.id, { status: 'rejected' }, { new: true });
    res.json(review);
  } catch { res.status(500).json({ error: 'Server error' }); }
});

// DELETE /api/reviews/:id
router.delete('/:id', authorize('team-lead', 'co-lead'), async (req, res: Response): Promise<void> => {
  try {
    await Review.findByIdAndDelete(req.params.id);
    res.json({ message: 'Review deleted' });
  } catch { res.status(500).json({ error: 'Server error' }); }
});

export default router;
