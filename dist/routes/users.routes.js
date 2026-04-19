"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const User_1 = require("../models/User");
const Project_1 = require("../models/Project");
const Review_1 = require("../models/Review");
const authenticate_1 = require("../middleware/authenticate");
const authorize_1 = require("../middleware/authorize");
const mongoose_1 = __importDefault(require("mongoose"));
const router = (0, express_1.Router)();
router.use(authenticate_1.authenticate);
// GET /api/users
router.get('/', (0, authorize_1.authorize)('team-lead', 'co-lead'), async (_req, res) => {
    try {
        const users = await User_1.User.find().select('-passwordHash').sort({ name: 1 });
        res.json(users);
    }
    catch {
        res.status(500).json({ error: 'Server error' });
    }
});
// POST /api/users
router.post('/', (0, authorize_1.authorize)('team-lead', 'co-lead'), async (req, res) => {
    try {
        const { name, email, password, role, skills, isActive } = req.body;
        const exists = await User_1.User.findOne({ email });
        if (exists) {
            res.status(400).json({ error: 'Email already registered' });
            return;
        }
        const user = await User_1.User.create({ name, email, passwordHash: password, role: role || 'member', skills: skills || [], isActive: isActive ?? true, isApproved: true });
        res.status(201).json({ id: user._id, name: user.name, email: user.email, role: user.role, avatar: user.avatar, skills: user.skills, isActive: user.isActive, isApproved: user.isApproved });
    }
    catch {
        res.status(500).json({ error: 'Server error' });
    }
});
// GET /api/users/:id
router.get('/:id', async (req, res) => {
    try {
        const user = await User_1.User.findById(req.params.id).select('-passwordHash');
        if (!user) {
            res.status(404).json({ error: 'User not found' });
            return;
        }
        res.json(user);
    }
    catch {
        res.status(500).json({ error: 'Server error' });
    }
});
// GET /api/users/:id/stats
router.get('/:id/stats', async (req, res) => {
    try {
        const userId = req.params.id;
        const projects = await Project_1.Project.find({ assignedUsers: new mongoose_1.default.Types.ObjectId(userId) });
        const delivered = projects.filter(p => p.status === 'Delivered');
        const wipProjects = projects.filter(p => p.status === 'WIP');
        const totalRevenue = delivered.reduce((sum, p) => sum + (p.deliveryAmount || 0), 0);
        const totalWIPValue = wipProjects.reduce((sum, p) => sum + (p.deliveryAmount || 0), 0);
        const reviews = await Review_1.Review.find({ submittedBy: userId, status: 'approved' });
        const avgRating = reviews.length ? reviews.reduce((s, r) => s + r.rating, 0) / reviews.length : 0;
        res.json({
            totalProjects: projects.length,
            byStatus: {
                WIP: wipProjects.length,
                Delivered: delivered.length,
                Revision: projects.filter(p => p.status === 'Revision').length,
                Cancelled: projects.filter(p => p.status === 'Cancelled').length,
            },
            totalRevenue,
            totalWIPValue,
            reviewsCount: reviews.length,
            avgRating: Math.round(avgRating * 10) / 10,
        });
    }
    catch {
        res.status(500).json({ error: 'Server error' });
    }
});
// PATCH /api/users/:id
router.patch('/:id', async (req, res) => {
    try {
        const { name, avatar, skills, role, isActive, isApproved, password } = req.body;
        const user = await User_1.User.findById(req.params.id);
        if (!user) {
            res.status(404).json({ error: 'User not found' });
            return;
        }
        if (name)
            user.name = name;
        if (avatar !== undefined)
            user.avatar = avatar;
        if (skills)
            user.skills = skills;
        if (req.user?.role === 'team-lead' || req.user?.role === 'co-lead') {
            if (role)
                user.role = role;
            if (isActive !== undefined)
                user.isActive = isActive;
            if (isApproved !== undefined)
                user.isApproved = isApproved;
            if (password)
                user.passwordHash = password; // pre-save hook will hash it
        }
        await user.save();
        res.json({
            id: user._id,
            name: user.name,
            email: user.email,
            role: user.role,
            avatar: user.avatar,
            skills: user.skills,
            isActive: user.isActive,
            isApproved: user.isApproved,
            badges: user.badges
        });
    }
    catch {
        res.status(500).json({ error: 'Server error' });
    }
});
// DELETE /api/users/:id
router.delete('/:id', (0, authorize_1.authorize)('team-lead', 'co-lead'), async (req, res) => {
    try {
        await User_1.User.findByIdAndUpdate(req.params.id, { isActive: false });
        res.json({ message: 'User deactivated' });
    }
    catch {
        res.status(500).json({ error: 'Server error' });
    }
});
exports.default = router;
//# sourceMappingURL=users.routes.js.map