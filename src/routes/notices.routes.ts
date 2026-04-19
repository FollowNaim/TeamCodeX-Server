import { Router, Response } from 'express';
import { Notice } from '../models/Notice';
import { authenticate, AuthRequest } from '../middleware/authenticate';
import { authorize } from '../middleware/authorize';

const router = Router();
router.use(authenticate);

router.get('/', async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { category } = req.query;
    const filter: Record<string, unknown> = {};
    if (category) filter.category = category;
    const notices = await Notice.find(filter)
      .populate('createdBy', 'name avatar')
      .populate('comments.userId', 'name avatar')
      .sort({ isPinned: -1, createdAt: -1 });
    const withUnread = notices.map(n => ({
      ...n.toObject(),
      isRead: n.readBy.some(uid => uid.toString() === req.user?.id),
    }));
    res.json(withUnread);
  } catch { res.status(500).json({ error: 'Server error' }); }
});

router.post('/', authorize('team-lead', 'co-lead'), async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const notice = await Notice.create({ ...req.body, createdBy: req.user?.id });
    res.status(201).json(notice);
  } catch (err: unknown) { res.status(400).json({ error: (err as Error).message }); }
});

router.patch('/:id', authorize('team-lead', 'co-lead'), async (req, res: Response): Promise<void> => {
  try {
    const notice = await Notice.findByIdAndUpdate(req.params.id, req.body, { new: true });
    res.json(notice);
  } catch { res.status(500).json({ error: 'Server error' }); }
});

router.delete('/:id', authorize('team-lead', 'co-lead'), async (req, res: Response): Promise<void> => {
  try {
    await Notice.findByIdAndDelete(req.params.id);
    res.json({ message: 'Notice deleted' });
  } catch { res.status(500).json({ error: 'Server error' }); }
});

router.post('/:id/read', async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    await Notice.findByIdAndUpdate(req.params.id, { $addToSet: { readBy: req.user?.id } });
    res.json({ message: 'Marked as read' });
  } catch { res.status(500).json({ error: 'Server error' }); }
});

router.post('/:id/comments', async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const notice = await Notice.findByIdAndUpdate(
      req.params.id,
      { $push: { comments: { userId: req.user?.id, text: req.body.text } } },
      { new: true }
    ).populate('comments.userId', 'name avatar');
    res.json(notice);
  } catch { res.status(500).json({ error: 'Server error' }); }
});

export default router;
