"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const Notice_1 = require("../models/Notice");
const authenticate_1 = require("../middleware/authenticate");
const authorize_1 = require("../middleware/authorize");
const router = (0, express_1.Router)();
router.use(authenticate_1.authenticate);
router.get('/', async (req, res) => {
    try {
        const { category } = req.query;
        const filter = {};
        if (category)
            filter.category = category;
        const notices = await Notice_1.Notice.find(filter)
            .populate('createdBy', 'name avatar')
            .populate('comments.userId', 'name avatar')
            .sort({ isPinned: -1, createdAt: -1 });
        const withUnread = notices.map(n => ({
            ...n.toObject(),
            isRead: n.readBy.some(uid => uid.toString() === req.user?.id),
        }));
        res.json(withUnread);
    }
    catch {
        res.status(500).json({ error: 'Server error' });
    }
});
router.post('/', (0, authorize_1.authorize)('team-lead', 'co-lead'), async (req, res) => {
    try {
        const notice = await Notice_1.Notice.create({ ...req.body, createdBy: req.user?.id });
        res.status(201).json(notice);
    }
    catch (err) {
        res.status(400).json({ error: err.message });
    }
});
router.patch('/:id', (0, authorize_1.authorize)('team-lead', 'co-lead'), async (req, res) => {
    try {
        const notice = await Notice_1.Notice.findByIdAndUpdate(req.params.id, req.body, { new: true });
        res.json(notice);
    }
    catch {
        res.status(500).json({ error: 'Server error' });
    }
});
router.delete('/:id', (0, authorize_1.authorize)('team-lead', 'co-lead'), async (req, res) => {
    try {
        await Notice_1.Notice.findByIdAndDelete(req.params.id);
        res.json({ message: 'Notice deleted' });
    }
    catch {
        res.status(500).json({ error: 'Server error' });
    }
});
router.post('/:id/read', async (req, res) => {
    try {
        await Notice_1.Notice.findByIdAndUpdate(req.params.id, { $addToSet: { readBy: req.user?.id } });
        res.json({ message: 'Marked as read' });
    }
    catch {
        res.status(500).json({ error: 'Server error' });
    }
});
router.post('/:id/comments', async (req, res) => {
    try {
        const notice = await Notice_1.Notice.findByIdAndUpdate(req.params.id, { $push: { comments: { userId: req.user?.id, text: req.body.text } } }, { new: true }).populate('comments.userId', 'name avatar');
        res.json(notice);
    }
    catch {
        res.status(500).json({ error: 'Server error' });
    }
});
exports.default = router;
//# sourceMappingURL=notices.routes.js.map