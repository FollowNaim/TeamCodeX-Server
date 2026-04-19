"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const Client_1 = require("../models/Client");
const Project_1 = require("../models/Project");
const authenticate_1 = require("../middleware/authenticate");
const authorize_1 = require("../middleware/authorize");
const auditLogger_1 = require("../middleware/auditLogger");
const encryption_1 = require("../services/encryption");
const router = (0, express_1.Router)();
router.use(authenticate_1.authenticate, (0, authorize_1.authorize)('team-lead', 'co-lead'));
// GET /api/clients
router.get('/', async (_req, res) => {
    try {
        const clients = await Client_1.Client.find().sort({ name: 1 });
        res.json(clients);
    }
    catch {
        res.status(500).json({ error: 'Server error' });
    }
});
// POST /api/clients
router.post('/', (0, auditLogger_1.auditLogger)('client.create', 'Client'), async (req, res) => {
    try {
        const { loginCredentials, ...rest } = req.body;
        const encryptedCreds = (loginCredentials || []).map((c) => {
            const { encrypted, iv } = (0, encryption_1.encrypt)(c.password);
            return { platform: c.platform, username: c.username, encryptedPassword: encrypted, iv };
        });
        const client = await Client_1.Client.create({ ...rest, loginCredentials: encryptedCreds, createdBy: req.user?.id });
        res.status(201).json(client);
    }
    catch (err) {
        res.status(400).json({ error: err.message });
    }
});
// GET /api/clients/:id
router.get('/:id', async (req, res) => {
    try {
        const client = await Client_1.Client.findById(req.params.id).select('-loginCredentials');
        if (!client) {
            res.status(404).json({ error: 'Not found' });
            return;
        }
        const projects = await Project_1.Project.find({ clientId: req.params.id }).select('title status price deadline');
        res.json({ client, projects });
    }
    catch {
        res.status(500).json({ error: 'Server error' });
    }
});
// GET /api/clients/:id/credentials
router.get('/:id/credentials', async (req, res) => {
    try {
        const client = await Client_1.Client.findById(req.params.id);
        if (!client) {
            res.status(404).json({ error: 'Not found' });
            return;
        }
        const decrypted = client.loginCredentials.map(c => ({
            platform: c.platform,
            username: c.username,
            password: (0, encryption_1.decrypt)(c.encryptedPassword, c.iv),
        }));
        res.json(decrypted);
    }
    catch {
        res.status(500).json({ error: 'Server error' });
    }
});
// GET /api/clients/:id/revenue
router.get('/:id/revenue', async (req, res) => {
    try {
        const projects = await Project_1.Project.find({ clientId: req.params.id, status: 'Delivered' }).select('title price deliveredAt');
        const total = projects.reduce((s, p) => s + p.price, 0);
        res.json({ total, projects });
    }
    catch {
        res.status(500).json({ error: 'Server error' });
    }
});
// PATCH /api/clients/:id
router.patch('/:id', (0, auditLogger_1.auditLogger)('client.update', 'Client'), async (req, res) => {
    try {
        const updated = await Client_1.Client.findByIdAndUpdate(req.params.id, req.body, { new: true });
        res.json(updated);
    }
    catch {
        res.status(500).json({ error: 'Server error' });
    }
});
// DELETE /api/clients/:id
router.delete('/:id', (0, auditLogger_1.auditLogger)('client.delete', 'Client'), async (req, res) => {
    try {
        await Client_1.Client.findByIdAndDelete(req.params.id);
        res.json({ message: 'Client deleted' });
    }
    catch {
        res.status(500).json({ error: 'Server error' });
    }
});
exports.default = router;
//# sourceMappingURL=clients.routes.js.map