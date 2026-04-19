import { Router, Request, Response } from 'express';
import jwt from 'jsonwebtoken';
import { User } from '../models/User';
import { env } from '../config/env';
import { authenticate, AuthRequest } from '../middleware/authenticate';

const router = Router();

const generateTokens = (user: { id: string; role: string; email: string; badges?: string[] }) => {
  const accessToken = jwt.sign({ id: user.id, role: user.role, email: user.email, badges: user.badges }, env.JWT_SECRET, {
    expiresIn: env.JWT_EXPIRES_IN as any,
  });
  const refreshToken = jwt.sign({ id: user.id }, env.JWT_REFRESH_SECRET, { expiresIn: env.JWT_REFRESH_EXPIRES_IN as any });
  return { accessToken, refreshToken };
};

// POST /api/auth/register (Public request access)
router.post('/register', async (req: Request, res: Response): Promise<void> => {
  try {
    const { name, email, password } = req.body;
    const exists = await User.findOne({ email });
    if (exists) { res.status(400).json({ error: 'Email already registered' }); return; }
    await User.create({ name, email, passwordHash: password, role: 'member', isApproved: false });
    res.status(201).json({ message: 'Registration requested. Please wait for leadership approval.' });
  } catch (err) { res.status(500).json({ error: 'Server error' }); }
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
    const isLead = user.role === 'team-lead' || user.role === 'co-lead';
    if (!user.isApproved && !isLead) { res.status(403).json({ error: 'Account pending leadership approval' }); return; }

    const { accessToken, refreshToken } = generateTokens({ id: user._id.toString(), role: user.role, email: user.email, badges: user.badges });
    res.json({ user: { id: user._id, name: user.name, email: user.email, role: user.role, avatar: user.avatar, badges: user.badges }, accessToken, refreshToken });
  } catch (err) { res.status(500).json({ error: 'Server error' }); }
});

// POST /api/auth/refresh

router.post('/refresh', async (req: Request, res: Response): Promise<void> => {
  try {
    const { refreshToken } = req.body;
    if (!refreshToken) { res.status(401).json({ error: 'No refresh token' }); return; }
    const decoded = jwt.verify(refreshToken, env.JWT_REFRESH_SECRET) as { id: string };
    const user = await User.findById(decoded.id);
    if (!user) { res.status(401).json({ error: 'User not found' }); return; }
    const tokens = generateTokens({ id: user._id.toString(), role: user.role, email: user.email, badges: user.badges });
    res.json(tokens);
  } catch { res.status(401).json({ error: 'Invalid refresh token' }); }
});

// GET /api/auth/me
router.get('/me', authenticate, async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const user = await User.findById(req.user?.id).select('-passwordHash');
    if (!user) { res.status(404).json({ error: 'User not found' }); return; }
    res.json(user);
  } catch { res.status(500).json({ error: 'Server error' }); }
});

export default router;
