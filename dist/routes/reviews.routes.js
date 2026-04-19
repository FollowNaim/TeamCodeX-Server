"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const Review_1 = require("../models/Review");
const authenticate_1 = require("../middleware/authenticate");
const authorize_1 = require("../middleware/authorize");
const router = (0, express_1.Router)();
router.use(authenticate_1.authenticate);
// GET /api/reviews
router.get('/', async (req, res) => {
    try {
        const isLead = req.user?.role === 'team-lead' || req.user?.role === 'co-lead';
        const filter = isLead ? {} : { submittedBy: req.user?.id };
        const reviews = await Review_1.Review.find(filter)
            .populate('clientId', 'name')
            .populate('projectId', 'title')
            .populate('submittedBy', 'name avatar')
            .sort({ createdAt: -1 });
        res.json(reviews);
    }
    catch {
        res.status(500).json({ error: 'Server error' });
    }
});
// GET /api/reviews/public
router.get('/public', async (_req, res) => {
    try {
        const reviews = await Review_1.Review.find({ status: 'approved' })
            .populate('clientId', 'name')
            .populate('submittedBy', 'name avatar')
            .sort({ createdAt: -1 });
        res.json(reviews);
    }
    catch {
        res.status(500).json({ error: 'Server error' });
    }
});
// POST /api/reviews
router.post('/', async (req, res) => {
    try {
        const review = await Review_1.Review.create({ ...req.body, submittedBy: req.user?.id });
        res.status(201).json(review);
    }
    catch (err) {
        res.status(400).json({ error: err.message });
    }
});
// PATCH /api/reviews/:id/approve
router.patch('/:id/approve', (0, authorize_1.authorize)('team-lead', 'co-lead'), async (req, res) => {
    try {
        const review = await Review_1.Review.findByIdAndUpdate(req.params.id, { status: 'approved', approvedBy: req.user?.id, approvedAt: new Date() }, { new: true });
        res.json(review);
    }
    catch {
        res.status(500).json({ error: 'Server error' });
    }
});
// PATCH /api/reviews/:id/reject
router.patch('/:id/reject', (0, authorize_1.authorize)('team-lead', 'co-lead'), async (req, res) => {
    try {
        const review = await Review_1.Review.findByIdAndUpdate(req.params.id, { status: 'rejected' }, { new: true });
        res.json(review);
    }
    catch {
        res.status(500).json({ error: 'Server error' });
    }
});
// DELETE /api/reviews/:id
router.delete('/:id', (0, authorize_1.authorize)('team-lead', 'co-lead'), async (req, res) => {
    try {
        await Review_1.Review.findByIdAndDelete(req.params.id);
        res.json({ message: 'Review deleted' });
    }
    catch {
        res.status(500).json({ error: 'Server error' });
    }
});
exports.default = router;
//# sourceMappingURL=reviews.routes.js.map