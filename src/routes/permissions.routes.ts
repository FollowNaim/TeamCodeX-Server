import { Router, Response } from 'express';
import { Permission } from '../models/Permission';
import { User } from '../models/User';
import { authenticate, AuthRequest, ResolvedPermissions } from '../middleware/authenticate';
import { requireOpsManager } from '../middleware/authorize';

const router = Router();
router.use(authenticate);

type UserRole = 'ops-manager' | 'team-lead' | 'co-lead' | 'member';

const getDefaultPermissions = (role: UserRole): ResolvedPermissions => {
  if (role === 'ops-manager') return { canViewAnalytics: true, canViewAllMembers: true, canManageProjects: true, canViewCrossTeam: true, canManageMembers: true, canAccessBazuka: true };
  if (role === 'team-lead' || role === 'co-lead') return { canViewAnalytics: true, canViewAllMembers: true, canManageProjects: true, canViewCrossTeam: false, canManageMembers: true, canAccessBazuka: true };
  return { canViewAnalytics: false, canViewAllMembers: false, canManageProjects: false, canViewCrossTeam: false, canManageMembers: false, canAccessBazuka: false };
};

// GET /api/permissions/:userId — get resolved permissions for a user
router.get('/:userId', requireOpsManager(), async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const user = await User.findById(req.params.userId).select('role name email');
    if (!user) { res.status(404).json({ error: 'User not found' }); return; }
    const permDoc = await Permission.findOne({ userId: req.params.userId });
    const defaults = getDefaultPermissions(user.role as UserRole);
    const resolved = permDoc ? { ...defaults, ...permDoc.overrides } : defaults;
    res.json({ userId: user._id, name: user.name, role: user.role, permissions: resolved, hasOverrides: !!permDoc });
  } catch { res.status(500).json({ error: 'Server error' }); }
});

// PUT /api/permissions/:userId — set/update overrides for a user
router.put('/:userId', requireOpsManager(), async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const user = await User.findById(req.params.userId).select('role');
    if (!user) { res.status(404).json({ error: 'User not found' }); return; }
    if (user.role === 'ops-manager') { res.status(400).json({ error: 'Cannot override ops-manager permissions' }); return; }

    const overrides = req.body.overrides as Partial<ResolvedPermissions>;
    const permDoc = await Permission.findOneAndUpdate(
      { userId: req.params.userId },
      { $set: { overrides } },
      { upsert: true, new: true }
    );
    res.json({ message: 'Permissions updated', permissions: permDoc.overrides });
  } catch { res.status(500).json({ error: 'Server error' }); }
});

// DELETE /api/permissions/:userId — remove all overrides (revert to role defaults)
router.delete('/:userId', requireOpsManager(), async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    await Permission.findOneAndDelete({ userId: req.params.userId });
    res.json({ message: 'Permissions reset to role defaults' });
  } catch { res.status(500).json({ error: 'Server error' }); }
});

// GET /api/permissions — list all users with overrides (ops-manager overview)
router.get('/', requireOpsManager(), async (_req, res: Response): Promise<void> => {
  try {
    const perms = await Permission.find().populate('userId', 'name email role avatar');
    res.json(perms);
  } catch { res.status(500).json({ error: 'Server error' }); }
});

export default router;
