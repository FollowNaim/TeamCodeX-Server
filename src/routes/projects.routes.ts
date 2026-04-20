import { Router, Response } from 'express';
import { Project } from '../models/Project';
import { Client } from '../models/Client';
import { User } from '../models/User';
import { Message } from '../models/Message';
import { authenticate, AuthRequest } from '../middleware/authenticate';
import { authorize } from '../middleware/authorize';
import { auditLogger } from '../middleware/auditLogger';
import mongoose from 'mongoose';

const router = Router();
router.use(authenticate);

// GET /api/projects
router.get('/', async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { status, priority, assignedUsers, title, search, date, sortBy = 'incomingDate', order = 'desc', page = '1', limit = '100' } = req.query;
    const skip = (Number(page) - 1) * Number(limit);
    const filter: Record<string, unknown> = {};
    const isLead = req.user?.role === 'team-lead' || req.user?.role === 'co-lead';
    if (!isLead) {
      filter.assignedUsers = new mongoose.Types.ObjectId(req.user?.id);
      filter.isBazuka = { $ne: true }; 
    } else {
      const { isBazuka } = req.query;
      if (isBazuka === 'true') filter.isBazuka = true;
    }
    if (status && status !== '') filter.status = status;
    if (priority && priority !== '') filter.priority = priority;
    if (title && title !== '') filter.title = title;
    
    if (assignedUsers && assignedUsers !== '') {
      filter.assignedUsers = new mongoose.Types.ObjectId(assignedUsers as string);
    }
    
    if (search) {
      const searchStr = search as string;
      const clientsFound = await Client.find({ name: { $regex: searchStr, $options: 'i' } }).select('_id');
      const clientIds = clientsFound.map(c => c._id);
      filter.$or = [
        { title: { $regex: searchStr, $options: 'i' } },
        { orderId: { $regex: searchStr, $options: 'i' } },
        { clientId: { $in: clientIds } }
      ];
    }
    
    const { month } = req.query;
    if (month) {
      const year = new Date().getFullYear();
      const start = new Date(year, Number(month) - 1, 1);
      const end = new Date(year, Number(month), 0);
      filter.createdAt = { $gte: start, $lte: end };
    }

    if (date) {
      const start = new Date(date as string);
      start.setHours(0, 0, 0, 0);
      const end = new Date(date as string);
      end.setHours(23, 59, 59, 999);
      
      if (status === 'Delivered') {
        filter.deliveredAt = { $gte: start, $lte: end };
      } else {
        filter.incomingDate = { $gte: start, $lte: end };
      }
    }

    const projects = await Project.find(filter)
      .populate('clientId', 'name email')
      .populate('assignedUsers', 'name avatar role')
      .sort({ [sortBy as string]: order === 'asc' ? 1 : -1 })
      .skip(skip)
      .limit(Number(limit))
      .lean();

    const total = await Project.countDocuments(filter);

    res.json({
      projects,
      total,
      page: Number(page),
      pages: Math.ceil(total / Number(limit))
    });
  } catch { res.status(500).json({ error: 'Server error' }); }
});

// POST /api/projects
router.post('/', authorize('team-lead', 'co-lead'), auditLogger('project.create', 'Project'), async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { clientName, ...rest } = req.body;
    let clientId = req.body.clientId;

    if (clientName && !clientId) {
      const client = await Client.findOneAndUpdate(
        { name: clientName },
        { name: clientName },
        { upsert: true, new: true, setDefaultsOnInsert: true }
      );
      clientId = client._id;
    }

    const payload = { ...rest, clientId, createdBy: req.user?.id };
    if (payload.status === 'Delivered') payload.deliveredAt = new Date();

    const project = await Project.create(payload);
    const populated = await project.populate(['clientId', 'assignedUsers']);
    res.status(201).json(populated);
  } catch (err: unknown) {
    const e = err as Error;
    res.status(400).json({ error: e.message });
  }
});

// POST /api/projects/import
router.post('/import', authorize('team-lead', 'co-lead'), async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    let projectsData = req.body.projects;
    if (!projectsData && Array.isArray(req.body)) projectsData = req.body;
    
    if (!Array.isArray(projectsData)) { 
      res.status(400).json({ error: 'Invalid format. Expected an array of projects or { projects: [...] }' }); 
      return; 
    }
    
    const imported = [];
    for (const data of projectsData) {
      let { clientName, profileName, title, orderNumber, orderId, assignedName, assignedUsers, ...rest } = data;
      
      // Map profileName to title
      if (!title && profileName) title = profileName;
      if (!title) title = 'Untitled Project';

      // Map orderNumber to orderId
      if (!orderId && orderNumber) orderId = orderNumber;

      // Map assignedName to assignedUsers array
      let usersToAssign = assignedUsers || [];
      if (assignedName && usersToAssign.length === 0) {
        const foundUser = await User.findOne({ name: new RegExp(`^${assignedName}$`, 'i') });
        if (foundUser) usersToAssign.push(foundUser._id);
      }

      let clientId = data.clientId;
      if (clientName && !clientId) {
        const client = await Client.findOneAndUpdate(
          { name: clientName },
          { name: clientName },
          { upsert: true, new: true, setDefaultsOnInsert: true }
        );
        clientId = client._id;
      }
      const projectPayload: any = { 
        ...rest, 
        title, 
        profileName, 
        orderId, 
        assignedUsers: usersToAssign,
        clientId, 
        createdBy: req.user?.id 
      };
      if (projectPayload.status === 'Delivered') projectPayload.deliveredAt = new Date();

      const project = await Project.create(projectPayload);
      imported.push(project);
    }
    res.status(201).json({ message: `Successfully imported ${imported.length} projects`, count: imported.length });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/projects/:id
router.get('/:id', async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const project = await Project.findById(req.params.id)
      .populate('clientId', 'name email website')
      .populate('assignedUsers', 'name avatar role badges')
      .populate('createdBy', 'name');
    if (!project) { res.status(404).json({ error: 'Project not found' }); return; }
    const isLead = req.user?.role === 'team-lead' || req.user?.role === 'co-lead';
    if (!isLead && !project.assignedUsers.some(u => (u as unknown as { _id: { toString(): string } })._id.toString() === req.user?.id)) {
      res.status(403).json({ error: 'Forbidden' }); return;
    }
    res.json(project);
  } catch { res.status(500).json({ error: 'Server error' }); }
});

// PATCH /api/projects/:id
router.patch('/:id', auditLogger('project.update', 'Project'), async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const project = await Project.findById(req.params.id);
    if (!project) { res.status(404).json({ error: 'Not found' }); return; }
    const isLead = req.user?.role === 'team-lead' || req.user?.role === 'co-lead';
    if (!isLead && !project.assignedUsers.some(u => u.toString() === req.user?.id)) {
      res.status(403).json({ error: 'Forbidden' }); return;
    }
    const { isBazuka, ...rest } = req.body;
    const allowedFields = isLead
      ? { ...rest, isBazuka }
      : { status: req.body.status, notes: req.body.notes, deadline: req.body.deadline };
      
    if (isLead && req.body.clientName) {
      const client = await Client.findOneAndUpdate(
        { name: req.body.clientName },
        { name: req.body.clientName },
        { upsert: true, new: true, setDefaultsOnInsert: true }
      );
      allowedFields.clientId = client._id;
    }

    if (allowedFields.status === 'Delivered') allowedFields.deliveredAt = new Date();
    const updated = await Project.findByIdAndUpdate(req.params.id, allowedFields, { new: true })
      .populate('clientId', 'name email')
      .populate('assignedUsers', 'name avatar');
    res.json(updated);
  } catch { res.status(500).json({ error: 'Server error' }); }
});

// DELETE /api/projects/:id
router.delete('/:id', authorize('team-lead', 'co-lead'), auditLogger('project.delete', 'Project'), async (req, res: Response): Promise<void> => {
  try {
    await Project.findByIdAndDelete(req.params.id);
    res.json({ message: 'Project deleted' });
  } catch { res.status(500).json({ error: 'Server error' }); }
});

// PATCH /api/projects/:id/subtasks/:sid
router.patch('/:id/subtasks/:sid', async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const project = await Project.findById(req.params.id);
    if (!project) { res.status(404).json({ error: 'Not found' }); return; }
    const subtask = project.subtasks.find(s => s._id.toString() === req.params.sid);
    if (!subtask) { res.status(404).json({ error: 'Subtask not found' }); return; }
    Object.assign(subtask, req.body);
    await project.save();
    res.json(project);
  } catch { res.status(500).json({ error: 'Server error' }); }
});

// GET /api/projects/:id/messages
router.get('/:id/messages', async (req, res: Response): Promise<void> => {
  try {
    const messages = await Message.find({ projectId: req.params.id })
      .populate('senderId', 'name avatar')
      .sort({ createdAt: 1 });
    res.json(messages);
  } catch { res.status(500).json({ error: 'Server error' }); }
});

// POST /api/projects/:id/messages
router.post('/:id/messages', async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const message = await Message.create({ ...req.body, projectId: req.params.id, senderId: req.user?.id });
    const populated = await message.populate('senderId', 'name avatar');
    res.status(201).json(populated);
  } catch { res.status(500).json({ error: 'Server error' }); }
});

export default router;
