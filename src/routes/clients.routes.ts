import { Router, Response } from 'express';
import { Client } from '../models/Client';
import { Project } from '../models/Project';
import { authenticate, AuthRequest } from '../middleware/authenticate';
import { authorize } from '../middleware/authorize';
import { auditLogger } from '../middleware/auditLogger';
import { encrypt, decrypt } from '../services/encryption';

const router = Router();
router.use(authenticate, authorize('team-lead', 'co-lead'));

// GET /api/clients
router.get('/', async (_req, res: Response): Promise<void> => {
  try {
    const clients = await Client.find().sort({ name: 1 });
    res.json(clients);
  } catch { res.status(500).json({ error: 'Server error' }); }
});

// POST /api/clients
router.post('/', auditLogger('client.create', 'Client'), async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { loginCredentials, ...rest } = req.body;
    const encryptedCreds = (loginCredentials || []).map((c: { platform: string; username: string; password: string }) => {
      const { encrypted, iv } = encrypt(c.password);
      return { platform: c.platform, username: c.username, encryptedPassword: encrypted, iv };
    });
    const client = await Client.create({ ...rest, loginCredentials: encryptedCreds, createdBy: req.user?.id });
    res.status(201).json(client);
  } catch (err: unknown) { res.status(400).json({ error: (err as Error).message }); }
});

// GET /api/clients/:id
router.get('/:id', async (req, res: Response): Promise<void> => {
  try {
    const client = await Client.findById(req.params.id).select('-loginCredentials');
    if (!client) { res.status(404).json({ error: 'Not found' }); return; }
    const projects = await Project.find({ clientId: req.params.id }).select('title status price deadline');
    res.json({ client, projects });
  } catch { res.status(500).json({ error: 'Server error' }); }
});

// GET /api/clients/:id/credentials
router.get('/:id/credentials', async (req, res: Response): Promise<void> => {
  try {
    const client = await Client.findById(req.params.id);
    if (!client) { res.status(404).json({ error: 'Not found' }); return; }
    const decrypted = client.loginCredentials.map(c => ({
      platform: c.platform,
      username: c.username,
      password: decrypt(c.encryptedPassword, c.iv),
    }));
    res.json(decrypted);
  } catch { res.status(500).json({ error: 'Server error' }); }
});

// GET /api/clients/:id/revenue
router.get('/:id/revenue', async (req, res: Response): Promise<void> => {
  try {
    const projects = await Project.find({ clientId: req.params.id, status: 'Delivered' }).select('title price deliveredAt');
    const total = projects.reduce((s, p) => s + p.price, 0);
    res.json({ total, projects });
  } catch { res.status(500).json({ error: 'Server error' }); }
});

// PATCH /api/clients/:id
router.patch('/:id', auditLogger('client.update', 'Client'), async (req, res: Response): Promise<void> => {
  try {
    const updated = await Client.findByIdAndUpdate(req.params.id, req.body, { new: true });
    res.json(updated);
  } catch { res.status(500).json({ error: 'Server error' }); }
});

// DELETE /api/clients/:id
router.delete('/:id', auditLogger('client.delete', 'Client'), async (req, res: Response): Promise<void> => {
  try {
    await Client.findByIdAndDelete(req.params.id);
    res.json({ message: 'Client deleted' });
  } catch { res.status(500).json({ error: 'Server error' }); }
});

export default router;
