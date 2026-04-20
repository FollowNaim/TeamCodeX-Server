import { Router, Response } from 'express';
import { User } from '../models/User';
import { Project } from '../models/Project';
import { Review } from '../models/Review';
import { Permission } from '../models/Permission';
import { authenticate, AuthRequest } from '../middleware/authenticate';
import { requireOpsManager, requireLeadership, isOpsManager } from '../middleware/authorize';
import mongoose from 'mongoose';

const router = Router();
router.use(authenticate);

// GET /api/users
router.get('/', requireLeadership(), async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    if (isOpsManager(req)) {
      const users = await User.find().select('-passwordHash').sort({ name: 1 });
      res.json(users);
    } else {
      // team-lead / co-lead — only their team
      const me = await User.findById(req.user?.id).select('teamId');
      const filter = me?.teamId ? { teamId: me.teamId } : { _id: req.user?.id };
      const users = await User.find(filter).select('-passwordHash').sort({ name: 1 });
      res.json(users);
    }
  } catch { res.status(500).json({ error: 'Server error' }); }
});

// POST /api/users — create user and assign to requester's team
router.post('/', requireLeadership(), async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { name, email, password, role, skills, isActive } = req.body;
    const exists = await User.findOne({ email });
    if (exists) { res.status(400).json({ error: 'Email already registered' }); return; }

    // Determine teamId — ops-manager can pass a specific teamId; leaders use their own
    let teamId = req.body.teamId;
    if (!isOpsManager(req)) {
      const me = await User.findById(req.user?.id).select('teamId');
      teamId = me?.teamId;
    }

    const user = await User.create({
      name, email, passwordHash: password, role: role || 'member',
      skills: skills || [], isActive: isActive ?? true, isApproved: true,
      teamId: teamId || null,
    });
    res.status(201).json({ id: user._id, name: user.name, email: user.email, role: user.role, avatar: user.avatar, skills: user.skills, isActive: user.isActive, isApproved: user.isApproved, teamId: user.teamId });
  } catch { res.status(500).json({ error: 'Server error' }); }
});

// GET /api/users/pending — unapproved users (leadership)
router.get('/pending', requireLeadership(), async (_req, res: Response): Promise<void> => {
  try {
    const users = await User.find({ isApproved: false, isActive: true }).select('-passwordHash').sort({ createdAt: -1 });
    res.json(users);
  } catch { res.status(500).json({ error: 'Server error' }); }
});

// GET /api/users/:id
router.get('/:id', async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const user = await User.findById(req.params.id).select('-passwordHash');
    if (!user) { res.status(404).json({ error: 'User not found' }); return; }
    // Members can only see themselves; leadership can see team members
    const isSelf = req.user?.id === req.params.id;
    if (!isSelf && req.user?.role === 'member') {
      res.status(403).json({ error: 'Forbidden' }); return;
    }
    res.json(user);
  } catch { res.status(500).json({ error: 'Server error' }); }
});

// GET /api/users/:id/stats
router.get('/:id/stats', async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    // Members can only see their own stats
    const isSelf = req.user?.id === req.params.id;
    if (req.user?.role === 'member' && !isSelf) {
      res.status(403).json({ error: 'Forbidden' }); return;
    }
    const userId = req.params.id as string;
    const projects = await Project.find({ assignedUsers: new mongoose.Types.ObjectId(userId) } as any);
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
      byStatus: { WIP: wipProjects.length, Delivered: delivered.length, Revision: projects.filter(p => p.status === 'Revision').length, Cancelled: projects.filter(p => p.status === 'Cancelled').length },
      totalRevenue, totalWIPValue,
      reviewsCount: reviews.length,
      avgRating: Math.round(avgRating * 10) / 10,
    });
  } catch { res.status(500).json({ error: 'Server error' }); }
});

// PATCH /api/users/:id
router.patch('/:id', async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { name, avatar, skills, role, isActive, isApproved, password, teamId } = req.body;
    const user = await User.findById(req.params.id);
    if (!user) { res.status(404).json({ error: 'User not found' }); return; }

    const isSelf = req.user?.id === req.params.id;
    const canAdmin = isOpsManager(req) || req.user?.role === 'team-lead' || req.user?.role === 'co-lead';

    if (name) user.name = name;
    if (avatar !== undefined) user.avatar = avatar;
    if (skills) user.skills = Array.isArray(skills) ? skills : [skills];

    if (canAdmin) {
      if (role && !isSelf) user.role = role;
      if (isActive !== undefined) user.isActive = isActive;
      if (isApproved !== undefined) user.isApproved = isApproved;
      if (password) user.passwordHash = password;
    }

    // Only ops-manager can move users between teams
    if (isOpsManager(req) && teamId !== undefined) user.teamId = teamId;

    await user.save();
    res.json({ id: user._id, name: user.name, email: user.email, role: user.role, avatar: user.avatar, skills: user.skills, isActive: user.isActive, isApproved: user.isApproved, badges: user.badges, teamId: user.teamId });
  } catch { res.status(500).json({ error: 'Server error' }); }
});

// PATCH /api/users/:id/permissions — ops-manager only permission override shortcut
router.patch('/:id/permissions', requireOpsManager(), async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const overrides = req.body;
    await Permission.findOneAndUpdate({ userId: req.params.id }, { $set: { overrides } }, { upsert: true, new: true });
    res.json({ message: 'Permissions updated' });
  } catch { res.status(500).json({ error: 'Server error' }); }
});

// DELETE /api/users/:id — deactivate
router.delete('/:id', requireLeadership(), async (req, res: Response): Promise<void> => {
  try {
    await User.findByIdAndUpdate(req.params.id, { isActive: false });
    res.json({ message: 'User deactivated' });
  } catch { res.status(500).json({ error: 'Server error' }); }
});

export default router;
