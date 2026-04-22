import { Router, Response } from 'express';
import { Todo } from '../models/Todo';
import { authenticate, AuthRequest } from '../middleware/authenticate';
import { auditLogger } from '../middleware/auditLogger';

const router = Router();
router.use(authenticate);

// GET /api/todos
router.get('/', async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const todos = await Todo.find().sort({ position: 1, createdAt: -1 });
    res.json(todos);
  } catch { res.status(500).json({ error: 'Server error' }); }
});

// POST /api/todos
router.post('/', auditLogger('todo.create', 'Todo'), async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { title, description, status, priority, position } = req.body;
    const todo = await Todo.create({ 
      title, 
      description, 
      status: status || 'Todo', 
      priority: priority || 'medium',
      position: position || 0,
      createdBy: req.user?.id 
    });
    res.status(201).json(todo);
  } catch { res.status(500).json({ error: 'Server error' }); }
});

// PATCH /api/todos/:id
router.patch('/:id', auditLogger('todo.update', 'Todo'), async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const todo = await Todo.findByIdAndUpdate(req.params.id, req.body, { new: true });
    if (!todo) { res.status(404).json({ error: 'Todo not found' }); return; }
    res.json(todo);
  } catch { res.status(500).json({ error: 'Server error' }); }
});

// DELETE /api/todos/:id
router.delete('/:id', auditLogger('todo.delete', 'Todo'), async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    await Todo.findByIdAndDelete(req.params.id);
    res.json({ message: 'Todo deleted' });
  } catch { res.status(500).json({ error: 'Server error' }); }
});

export default router;
