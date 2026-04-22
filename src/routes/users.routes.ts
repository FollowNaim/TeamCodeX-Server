import { Router, Response } from 'express';
import { User } from '../models/User';
import { Project } from '../models/Project';
import { Review } from '../models/Review';
import { authenticate, AuthRequest } from '../middleware/authenticate';
import { authorize } from '../middleware/authorize';
import mongoose from 'mongoose';

const router = Router();
router.use(authenticate);

// GET /api/users
router.get('/', authorize('team-lead', 'co-lead'), async (_req, res: Response): Promise<void> => {
  try {
    const users = await User.find().select('-passwordHash').sort({ name: 1 });
    res.json(users);
  } catch { res.status(500).json({ error: 'Server error' }); }
});

// POST /api/users
router.post('/', authorize('team-lead', 'co-lead'), async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { name, email, password, role, skills, isActive } = req.body;
    const exists = await User.findOne({ email });
    if (exists) { res.status(400).json({ error: 'Email already registered' }); return; }
    const user = await User.create({ name, email, passwordHash: password, role: role || 'member', skills: skills || [], isActive: isActive ?? true, isApproved: true });
    res.status(201).json({ id: user._id, name: user.name, email: user.email, role: user.role, avatar: user.avatar, skills: user.skills, isActive: user.isActive, isApproved: user.isApproved });
  } catch { res.status(500).json({ error: 'Server error' }); }
});

// GET /api/users/:id
router.get('/:id', async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const user = await User.findById(req.params.id).select('-passwordHash');
    if (!user) { res.status(404).json({ error: 'User not found' }); return; }
    res.json(user);
  } catch { res.status(500).json({ error: 'Server error' }); }
});

// GET /api/users/:id/stats
router.get('/:id/stats', async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const userId = req.params.id as string;
    const projects = await Project.find({ assignedUsers: new mongoose.Types.ObjectId(userId) });
    const delivered = projects.filter(p => p.status === 'Delivered');
    const wipProjects = projects.filter(p => p.status === 'WIP');
    const totalRevenue = delivered.reduce((sum, p) => {
      const count = p.assignedUsers.length || 1;
      return sum + ((p.price * 0.8) / count);
    }, 0);
    const totalWIPValue = wipProjects.reduce((sum, p) => {
      const count = p.assignedUsers.length || 1;
      return sum + ((p.deliveryAmount || 0) / count);
    }, 0);
    const reviews = await Review.find({ submittedBy: userId, status: 'approved' });
    const avgRating = reviews.length ? reviews.reduce((s, r) => s + r.rating, 0) / reviews.length : 0;

    res.json({
      totalProjects: projects.length,
      byStatus: {
        WIP: wipProjects.length,
        Delivered: delivered.length,
        Revision: projects.filter(p => p.status === 'Revision').length,
        Cancelled: projects.filter(p => p.status === 'Cancelled').length,
      },
      totalRevenue,
      totalWIPValue,
      reviewsCount: reviews.length,
      avgRating: Math.round(avgRating * 10) / 10,
    });
  } catch { res.status(500).json({ error: 'Server error' }); }
});

// PATCH /api/users/:id
router.patch('/:id', async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { name, avatar, skills, role, isActive, isApproved, password } = req.body;
    
    const user = await User.findById(req.params.id);
    if (!user) { res.status(404).json({ error: 'User not found' }); return; }

    if (name) user.name = name;
    if (avatar !== undefined) user.avatar = avatar;
    if (skills) user.skills = skills;

    if (password && (req.user?.role === 'team-lead' || req.user?.role === 'co-lead' || req.user?.id === req.params.id)) {
      user.passwordHash = password; // pre-save hook will hash it
    }

    if (req.user?.role === 'team-lead' || req.user?.role === 'co-lead') {
      if (role) user.role = role;
      if (isActive !== undefined) user.isActive = isActive;
      if (isApproved !== undefined) user.isApproved = isApproved;
    }

    await user.save();

    res.json({
      id: user._id,
      name: user.name,
      email: user.email,
      role: user.role,
      avatar: user.avatar,
      skills: user.skills,
      isActive: user.isActive,
      isApproved: user.isApproved,
      badges: user.badges
    });
  } catch { res.status(500).json({ error: 'Server error' }); }
});

// DELETE /api/users/:id
router.delete('/:id', authorize('team-lead', 'co-lead'), async (req, res: Response): Promise<void> => {
  try {
    await User.findByIdAndUpdate(req.params.id, { isActive: false });
    res.json({ message: 'User deactivated' });
  } catch { res.status(500).json({ error: 'Server error' }); }
});

export default router;
