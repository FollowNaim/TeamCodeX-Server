"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const Resource_1 = require("../models/Resource");
const authenticate_1 = require("../middleware/authenticate");
const authorize_1 = require("../middleware/authorize");
const mongoose_1 = __importDefault(require("mongoose"));
const router = (0, express_1.Router)();
router.use(authenticate_1.authenticate);
// GET /api/resources
router.get('/', async (req, res) => {
    try {
        const userId = new mongoose_1.default.Types.ObjectId(req.user?.id);
        const resources = await Resource_1.Resource.find({
            $or: [{ visibleTo: 'all' }, { visibleTo: userId }],
        }).populate('uploadedBy', 'name').sort({ createdAt: -1 });
        res.json(resources);
    }
    catch {
        res.status(500).json({ error: 'Server error' });
    }
});
// POST /api/resources
router.post('/', (0, authorize_1.authorize)('team-lead', 'co-lead'), async (req, res) => {
    try {
        const resource = await Resource_1.Resource.create({ ...req.body, uploadedBy: req.user?.id });
        res.status(201).json(resource);
    }
    catch (err) {
        res.status(400).json({ error: err.message });
    }
});
// PATCH /api/resources/:id
router.patch('/:id', (0, authorize_1.authorize)('team-lead', 'co-lead'), async (req, res) => {
    try {
        const resource = await Resource_1.Resource.findByIdAndUpdate(req.params.id, req.body, { new: true });
        res.json(resource);
    }
    catch {
        res.status(500).json({ error: 'Server error' });
    }
});
// DELETE /api/resources/:id
router.delete('/:id', (0, authorize_1.authorize)('team-lead', 'co-lead'), async (req, res) => {
    try {
        await Resource_1.Resource.findByIdAndDelete(req.params.id);
        res.json({ message: 'Resource deleted' });
    }
    catch {
        res.status(500).json({ error: 'Server error' });
    }
});
exports.default = router;
//# sourceMappingURL=resources.routes.js.map