import { Router, Response } from 'express';
import { ChatMessage } from '../models/ChatMessage';
import { AuthRequest } from '../middleware/authenticate';

const router = Router();

// GET /api/chat/messages
router.get('/messages', async (_req: AuthRequest, res: Response): Promise<void> => {
  try {
    const messages = await ChatMessage.find()
      .populate('sender', 'name avatar badges role')
      .sort({ createdAt: -1 })
      .limit(50);
    res.json(messages.reverse());
  } catch {
    res.status(500).json({ error: 'Failed to fetch messages' });
  }
});

// DELETE /api/chat/messages/:id
router.delete('/messages/:id', async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const message = await ChatMessage.findById(req.params.id);
    if (!message) { res.status(404).json({ error: 'Not found' }); return; }
    
    // Team Lead or Co Lead or sender can delete
    const isAuthorized = 
      ['team-lead', 'co-lead'].includes(req.user?.role || '') || 
      message.sender.toString() === req.user?.id;

    if (!isAuthorized) {
      console.log(`Delete unauthorized: user role ${req.user?.role}, user id ${req.user?.id}, msg sender ${message.sender}`);
      res.status(403).json({ error: 'Unauthorized' }); return;
    }
    
    await ChatMessage.findByIdAndDelete(req.params.id);
    res.json({ success: true });
  } catch (err) { 
    console.error('Delete error:', err);
    res.status(500).json({ error: 'Server error' }); 
  }
});

// PATCH /api/chat/messages/:id (Edit)
router.patch('/messages/:id', async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const message = await ChatMessage.findById(req.params.id);
    if (!message) { res.status(404).json({ error: 'Not found' }); return; }
    
    if (message.sender.toString() !== req.user?.id) {
      res.status(403).json({ error: 'Only sender can edit' }); return;
    }
    
    message.text = req.body.text;
    await message.save();
    res.json(message);
  } catch { res.status(500).json({ error: 'Server error' }); }
});

export default router;
