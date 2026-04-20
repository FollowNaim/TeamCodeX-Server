import { Router, Request, Response } from 'express';
import jwt from 'jsonwebtoken';
import { User } from '../models/User';
import { Permission } from '../models/Permission';
import { env } from '../config/env';
import { authenticate, AuthRequest, ResolvedPermissions } from '../middleware/authenticate';

const router = Router();

type UserRole = 'ops-manager' | 'team-lead' | 'co-lead' | 'member';

const getDefaultPermissions = (role: UserRole): ResolvedPermissions => {
  if (role === 'ops-manager') {
    return { canViewAnalytics: true, canViewAllMembers: true, canManageProjects: true, canViewCrossTeam: true, canManageMembers: true, canAccessBazuka: true };
  }
  if (role === 'team-lead' || role === 'co-lead') {
    return { canViewAnalytics: true, canViewAllMembers: true, canManageProjects: true, canViewCrossTeam: false, canManageMembers: true, canAccessBazuka: true };
  }
  // member defaults — most access denied
  return { canViewAnalytics: false, canViewAllMembers: false, canManageProjects: false, canViewCrossTeam: false, canManageMembers: false, canAccessBazuka: false };
};

const generateTokens = (payload: { id: string; role: string; email: string; teamId?: string; badges?: string[]; permissions?: ResolvedPermissions }) => {
  const accessToken = jwt.sign(payload, env.JWT_SECRET, { expiresIn: env.JWT_EXPIRES_IN as any });
  const refreshToken = jwt.sign({ id: payload.id }, env.JWT_REFRESH_SECRET, { expiresIn: env.JWT_REFRESH_EXPIRES_IN as any });
  return { accessToken, refreshToken };
};

// POST /api/auth/register
router.post('/register', async (req: Request, res: Response): Promise<void> => {
  try {
    const { name, email, password } = req.body;
    const exists = await User.findOne({ email });
    if (exists) { res.status(400).json({ error: 'Email already registered' }); return; }
    await User.create({ name, email, passwordHash: password, role: 'member', isApproved: false });
    res.status(201).json({ message: 'Registration requested. Please wait for leadership approval.' });
  } catch { res.status(500).json({ error: 'Server error' }); }
});

// POST /api/auth/login
router.post('/login', async (req: Request, res: Response): Promise<void> => {
  try {
    const { email, password } = req.body;
    const user = await User.findOne({ email });
    if (!user || !(await user.comparePassword(password))) {
      res.status(401).json({ error: 'Invalid email or password' }); return;
    }
    if (!user.isActive) { res.status(403).json({ error: 'Account deactivated' }); return; }

    const isElevated = user.role === 'ops-manager' || user.role === 'team-lead' || user.role === 'co-lead';
    if (!user.isApproved && !isElevated) { res.status(403).json({ error: 'Account pending approval' }); return; }

    // Resolve permissions: check DB overrides, fall back to role defaults
    const permDoc = await Permission.findOne({ userId: user._id });
    const defaults = getDefaultPermissions(user.role as UserRole);
    const permissions: ResolvedPermissions = permDoc ? { ...defaults, ...permDoc.overrides } : defaults;

    const payload = {
      id: user._id.toString(),
      role: user.role,
      email: user.email,
      teamId: user.teamId?.toString(),
      badges: user.badges,
      permissions,
    };

    const { accessToken, refreshToken } = generateTokens(payload);
    res.json({
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        role: user.role,
        avatar: user.avatar,
        badges: user.badges,
        teamId: user.teamId,
        permissions,
      },
      accessToken,
      refreshToken,
    });
  } catch { res.status(500).json({ error: 'Server error' }); }
});

// POST /api/auth/refresh
router.post('/refresh', async (req: Request, res: Response): Promise<void> => {
  try {
    const { refreshToken } = req.body;
    if (!refreshToken) { res.status(401).json({ error: 'No refresh token' }); return; }
    const decoded = jwt.verify(refreshToken, env.JWT_REFRESH_SECRET) as { id: string };
    const user = await User.findById(decoded.id);
    if (!user) { res.status(401).json({ error: 'User not found' }); return; }

    const permDoc = await Permission.findOne({ userId: user._id });
    const defaults = getDefaultPermissions(user.role as UserRole);
    const permissions: ResolvedPermissions = permDoc ? { ...defaults, ...permDoc.overrides } : defaults;

    const payload = { id: user._id.toString(), role: user.role, email: user.email, teamId: user.teamId?.toString(), badges: user.badges, permissions };
    const tokens = generateTokens(payload);
    res.json(tokens);
  } catch { res.status(401).json({ error: 'Invalid refresh token' }); }
});

// GET /api/auth/me
router.get('/me', authenticate, async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const user = await User.findById(req.user?.id).select('-passwordHash').populate('teamId', 'name');
    if (!user) { res.status(404).json({ error: 'User not found' }); return; }

    const permDoc = await Permission.findOne({ userId: user._id });
    const defaults = getDefaultPermissions(user.role as UserRole);
    const permissions: ResolvedPermissions = permDoc ? { ...defaults, ...permDoc.overrides } : defaults;

    res.json({ ...user.toObject(), permissions });
  } catch { res.status(500).json({ error: 'Server error' }); }
});

export default router;
