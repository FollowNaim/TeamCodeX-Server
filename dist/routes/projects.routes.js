"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const Project_1 = require("../models/Project");
const Client_1 = require("../models/Client");
const User_1 = require("../models/User");
const Message_1 = require("../models/Message");
const authenticate_1 = require("../middleware/authenticate");
const authorize_1 = require("../middleware/authorize");
const auditLogger_1 = require("../middleware/auditLogger");
const mongoose_1 = __importDefault(require("mongoose"));
const router = (0, express_1.Router)();
router.use(authenticate_1.authenticate);
// GET /api/projects
router.get('/', async (req, res) => {
    try {
        const { status, priority, assignedUsers, title, search, sortBy = 'incomingDate', order = 'desc' } = req.query;
        const filter = {};
        const isLead = req.user?.role === 'team-lead' || req.user?.role === 'co-lead';
        if (!isLead) {
            filter.assignedUsers = new mongoose_1.default.Types.ObjectId(req.user?.id);
            filter.isBazuka = { $ne: true };
        }
        else {
            const { isBazuka } = req.query;
            if (isBazuka === 'true')
                filter.isBazuka = true;
        }
        if (status)
            filter.status = status;
        if (priority)
            filter.priority = priority;
        if (title)
            filter.title = title;
        if (assignedUsers)
            filter.assignedUsers = new mongoose_1.default.Types.ObjectId(assignedUsers);
        if (search) {
            const searchStr = search;
            const clientsFound = await Client_1.Client.find({ name: { $regex: searchStr, $options: 'i' } }).select('_id');
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
        const projects = await Project_1.Project.find(filter)
            .populate('clientId', 'name email')
            .populate('assignedUsers', 'name avatar role')
            .sort({ [sortBy]: order === 'asc' ? 1 : -1 })
            .lean();
        res.json(projects);
    }
    catch {
        res.status(500).json({ error: 'Server error' });
    }
});
// POST /api/projects
router.post('/', (0, authorize_1.authorize)('team-lead', 'co-lead'), (0, auditLogger_1.auditLogger)('project.create', 'Project'), async (req, res) => {
    try {
        const { clientName, ...rest } = req.body;
        let clientId = req.body.clientId;
        if (clientName && !clientId) {
            const client = await Client_1.Client.findOneAndUpdate({ name: clientName }, { name: clientName }, { upsert: true, new: true, setDefaultsOnInsert: true });
            clientId = client._id;
        }
        const project = await Project_1.Project.create({ ...rest, clientId, createdBy: req.user?.id });
        const populated = await project.populate(['clientId', 'assignedUsers']);
        res.status(201).json(populated);
    }
    catch (err) {
        const e = err;
        res.status(400).json({ error: e.message });
    }
});
// POST /api/projects/import
router.post('/import', (0, authorize_1.authorize)('team-lead', 'co-lead'), async (req, res) => {
    try {
        let projectsData = req.body.projects;
        if (!projectsData && Array.isArray(req.body))
            projectsData = req.body;
        if (!Array.isArray(projectsData)) {
            res.status(400).json({ error: 'Invalid format. Expected an array of projects or { projects: [...] }' });
            return;
        }
        const imported = [];
        for (const data of projectsData) {
            let { clientName, profileName, title, orderNumber, orderId, assignedName, assignedUsers, ...rest } = data;
            // Map profileName to title
            if (!title && profileName)
                title = profileName;
            if (!title)
                title = 'Untitled Project';
            // Map orderNumber to orderId
            if (!orderId && orderNumber)
                orderId = orderNumber;
            // Map assignedName to assignedUsers array
            let usersToAssign = assignedUsers || [];
            if (assignedName && usersToAssign.length === 0) {
                const foundUser = await User_1.User.findOne({ name: new RegExp(`^${assignedName}$`, 'i') });
                if (foundUser)
                    usersToAssign.push(foundUser._id);
            }
            let clientId = data.clientId;
            if (clientName && !clientId) {
                const client = await Client_1.Client.findOneAndUpdate({ name: clientName }, { name: clientName }, { upsert: true, new: true, setDefaultsOnInsert: true });
                clientId = client._id;
            }
            const project = await Project_1.Project.create({
                ...rest,
                title,
                profileName,
                orderId,
                assignedUsers: usersToAssign,
                clientId,
                createdBy: req.user?.id
            });
            imported.push(project);
        }
        res.status(201).json({ message: `Successfully imported ${imported.length} projects`, count: imported.length });
    }
    catch (err) {
        res.status(500).json({ error: err.message });
    }
});
// GET /api/projects/:id
router.get('/:id', async (req, res) => {
    try {
        const project = await Project_1.Project.findById(req.params.id)
            .populate('clientId', 'name email website')
            .populate('assignedUsers', 'name avatar role badges')
            .populate('createdBy', 'name');
        if (!project) {
            res.status(404).json({ error: 'Project not found' });
            return;
        }
        const isLead = req.user?.role === 'team-lead' || req.user?.role === 'co-lead';
        if (!isLead && !project.assignedUsers.some(u => u._id.toString() === req.user?.id)) {
            res.status(403).json({ error: 'Forbidden' });
            return;
        }
        res.json(project);
    }
    catch {
        res.status(500).json({ error: 'Server error' });
    }
});
// PATCH /api/projects/:id
router.patch('/:id', (0, auditLogger_1.auditLogger)('project.update', 'Project'), async (req, res) => {
    try {
        const project = await Project_1.Project.findById(req.params.id);
        if (!project) {
            res.status(404).json({ error: 'Not found' });
            return;
        }
        const isLead = req.user?.role === 'team-lead' || req.user?.role === 'co-lead';
        if (!isLead && !project.assignedUsers.some(u => u.toString() === req.user?.id)) {
            res.status(403).json({ error: 'Forbidden' });
            return;
        }
        const { isBazuka, ...rest } = req.body;
        const allowedFields = isLead
            ? { ...rest, isBazuka }
            : { status: req.body.status, notes: req.body.notes, deadline: req.body.deadline };
        if (isLead && req.body.clientName) {
            const client = await Client_1.Client.findOneAndUpdate({ name: req.body.clientName }, { name: req.body.clientName }, { upsert: true, new: true, setDefaultsOnInsert: true });
            allowedFields.clientId = client._id;
        }
        if (allowedFields.status === 'Delivered')
            allowedFields.deliveredAt = new Date();
        const updated = await Project_1.Project.findByIdAndUpdate(req.params.id, allowedFields, { new: true })
            .populate('clientId', 'name email')
            .populate('assignedUsers', 'name avatar');
        res.json(updated);
    }
    catch {
        res.status(500).json({ error: 'Server error' });
    }
});
// DELETE /api/projects/:id
router.delete('/:id', (0, authorize_1.authorize)('team-lead', 'co-lead'), (0, auditLogger_1.auditLogger)('project.delete', 'Project'), async (req, res) => {
    try {
        await Project_1.Project.findByIdAndDelete(req.params.id);
        res.json({ message: 'Project deleted' });
    }
    catch {
        res.status(500).json({ error: 'Server error' });
    }
});
// PATCH /api/projects/:id/subtasks/:sid
router.patch('/:id/subtasks/:sid', async (req, res) => {
    try {
        const project = await Project_1.Project.findById(req.params.id);
        if (!project) {
            res.status(404).json({ error: 'Not found' });
            return;
        }
        const subtask = project.subtasks.find(s => s._id.toString() === req.params.sid);
        if (!subtask) {
            res.status(404).json({ error: 'Subtask not found' });
            return;
        }
        Object.assign(subtask, req.body);
        await project.save();
        res.json(project);
    }
    catch {
        res.status(500).json({ error: 'Server error' });
    }
});
// GET /api/projects/:id/messages
router.get('/:id/messages', async (req, res) => {
    try {
        const messages = await Message_1.Message.find({ projectId: req.params.id })
            .populate('senderId', 'name avatar')
            .sort({ createdAt: 1 });
        res.json(messages);
    }
    catch {
        res.status(500).json({ error: 'Server error' });
    }
});
// POST /api/projects/:id/messages
router.post('/:id/messages', async (req, res) => {
    try {
        const message = await Message_1.Message.create({ ...req.body, projectId: req.params.id, senderId: req.user?.id });
        const populated = await message.populate('senderId', 'name avatar');
        res.status(201).json(populated);
    }
    catch {
        res.status(500).json({ error: 'Server error' });
    }
});
exports.default = router;
//# sourceMappingURL=projects.routes.js.map