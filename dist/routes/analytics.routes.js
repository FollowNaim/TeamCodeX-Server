"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const Project_1 = require("../models/Project");
const User_1 = require("../models/User");
const Review_1 = require("../models/Review");
const authenticate_1 = require("../middleware/authenticate");
const mongoose_1 = __importDefault(require("mongoose"));
const router = (0, express_1.Router)();
router.get('/public', async (_req, res) => {
    try {
        const projectStats = await Project_1.Project.aggregate([
            { $group: { _id: null, totalProjects: { $sum: 1 }, totalRevenue: { $sum: '$price' } } }
        ]);
        const topPerformers = await Project_1.Project.aggregate([
            { $match: { status: 'Delivered' } },
            { $unwind: '$assignedUsers' },
            { $group: { _id: '$assignedUsers', totalRevenue: { $sum: '$price' }, projectsDelivered: { $sum: 1 } } },
            { $sort: { totalRevenue: -1 } },
            { $limit: 3 },
            { $lookup: { from: 'users', localField: '_id', foreignField: '_id', as: 'user' } },
            { $unwind: '$user' },
            { $project: { _id: 1, name: '$user.name', avatar: '$user.avatar', totalRevenue: 1, projectsDelivered: 1 } }
        ]);
        res.json({
            globalStats: {
                totalProjects: projectStats[0]?.totalProjects || 0,
                totalRevenue: projectStats[0]?.totalRevenue || 0
            },
            topPerformers
        });
    }
    catch (err) {
        const e = err;
        res.status(500).json({ error: e.message });
    }
});
router.use(authenticate_1.authenticate);
router.get('/overview', async (req, res) => {
    try {
        const [projects, users] = await Promise.all([
            Project_1.Project.find(),
            User_1.User.countDocuments({ isActive: true }),
        ]);
        const delivered = projects.filter(p => p.status === 'Delivered');
        const totalRevenue = delivered.reduce((s, p) => s + p.price, 0);
        const avgDeliveryMs = delivered.filter(p => p.deliveredAt).reduce((s, p) => {
            return s + (p.deliveredAt.getTime() - p.createdAt.getTime());
        }, 0) / (delivered.length || 1);
        const wipProjects = projects.filter(p => p.status === 'WIP');
        const totalWIPValue = wipProjects.reduce((s, p) => s + (p.deliveryAmount || 0), 0);
        res.json({
            totalProjects: projects.length,
            activeMembers: users,
            totalRevenue,
            totalWIPValue,
            avgDeliveryDays: Math.round(avgDeliveryMs / 86400000),
            byStatus: {
                WIP: wipProjects.length,
                Delivered: delivered.length,
                Revision: projects.filter(p => p.status === 'Revision').length,
                Cancelled: projects.filter(p => p.status === 'Cancelled').length,
            },
        });
    }
    catch {
        res.status(500).json({ error: 'Server error' });
    }
});
router.get('/team-breakdown', async (_req, res) => {
    try {
        const data = await Project_1.Project.aggregate([
            { $unwind: '$assignedUsers' },
            { $group: {
                    _id: { user: '$assignedUsers', status: '$status' },
                    count: { $sum: 1 },
                    value: { $sum: '$deliveryAmount' }
                } },
            { $lookup: { from: 'users', localField: '_id.user', foreignField: '_id', as: 'user' } },
            { $unwind: '$user' },
            { $group: {
                    _id: '$_id.user',
                    name: { $first: '$user.name' },
                    avatar: { $first: '$user.avatar' },
                    email: { $first: '$user.email' },
                    WIP: { $sum: { $cond: [{ $eq: ['$_id.status', 'WIP'] }, '$count', 0] } },
                    WIPValue: { $sum: { $cond: [{ $eq: ['$_id.status', 'WIP'] }, '$value', 0] } },
                    Delivered: { $sum: { $cond: [{ $eq: ['$_id.status', 'Delivered'] }, '$count', 0] } },
                    DeliveredValue: { $sum: { $cond: [{ $eq: ['$_id.status', 'Delivered'] }, '$value', 0] } },
                    Revision: { $sum: { $cond: [{ $eq: ['$_id.status', 'Revision'] }, '$count', 0] } },
                    RevisionValue: { $sum: { $cond: [{ $eq: ['$_id.status', 'Revision'] }, '$value', 0] } },
                    Cancelled: { $sum: { $cond: [{ $eq: ['$_id.status', 'Cancelled'] }, '$count', 0] } },
                    CancelledValue: { $sum: { $cond: [{ $eq: ['$_id.status', 'Cancelled'] }, '$value', 0] } },
                    total: { $sum: '$count' },
                    totalValue: { $sum: '$value' }
                } },
            { $sort: { total: -1 } }
        ]);
        res.json(data);
    }
    catch {
        res.status(500).json({ error: 'Server error' });
    }
});
router.get('/me', async (req, res) => {
    try {
        const userId = req.user?.id;
        if (!userId) {
            res.status(401).json({ error: 'Unauthorized' });
            return;
        }
        const projects = await Project_1.Project.find({ assignedUsers: new mongoose_1.default.Types.ObjectId(userId) });
        const delivered = projects.filter(p => p.status === 'Delivered');
        const totalRevenue = delivered.reduce((sum, p) => sum + (p.deliveryAmount || 0), 0);
        const reviews = await Review_1.Review.find({ submittedBy: userId, status: 'approved' });
        const avgRating = reviews.length ? reviews.reduce((s, r) => s + r.rating, 0) / reviews.length : 0;
        const wipProjects = projects.filter(p => p.status === 'WIP');
        const totalWIPValue = wipProjects.reduce((sum, p) => sum + (p.deliveryAmount || 0), 0);
        res.json({
            totalProjects: projects.length,
            totalRevenue,
            totalWIPValue,
            avgRating: Math.round(avgRating * 10) / 10,
            byStatus: {
                WIP: wipProjects.length,
                Delivered: delivered.length,
                Revision: projects.filter(p => p.status === 'Revision').length,
                Cancelled: projects.filter(p => p.status === 'Cancelled').length,
            },
        });
    }
    catch {
        res.status(500).json({ error: 'Server error' });
    }
});
router.get('/leaderboard', async (_req, res) => {
    try {
        const leaderboard = await Project_1.Project.aggregate([
            { $match: { status: 'Delivered' } },
            { $unwind: '$assignedUsers' },
            { $group: {
                    _id: '$assignedUsers',
                    projectsDelivered: { $sum: 1 },
                    totalRevenue: { $sum: '$deliveryAmount' },
                } },
            { $sort: { totalRevenue: -1 } },
            { $limit: 10 },
            { $lookup: { from: 'users', localField: '_id', foreignField: '_id', as: 'user' } },
            { $unwind: '$user' },
            { $project: { 'user.passwordHash': 0 } },
        ]);
        res.json(leaderboard);
    }
    catch {
        res.status(500).json({ error: 'Server error' });
    }
});
router.get('/projects/status', async (_req, res) => {
    try {
        const data = await Project_1.Project.aggregate([
            { $group: { _id: '$status', count: { $sum: 1 }, revenue: { $sum: '$deliveryAmount' } } },
        ]);
        res.json(data);
    }
    catch {
        res.status(500).json({ error: 'Server error' });
    }
});
router.get('/projects/profile', async (_req, res) => {
    try {
        const data = await Project_1.Project.aggregate([
            { $group: {
                    _id: '$profileName',
                    count: { $sum: 1 },
                    revenue: { $sum: '$deliveryAmount' }
                } },
            { $sort: { revenue: -1 } }
        ]);
        res.json(data);
    }
    catch {
        res.status(500).json({ error: 'Server error' });
    }
});
router.get('/members/performance', async (_req, res) => {
    try {
        const data = await Project_1.Project.aggregate([
            { $unwind: '$assignedUsers' },
            { $group: {
                    _id: { user: '$assignedUsers', status: '$status' },
                    count: { $sum: 1 },
                    revenue: { $sum: '$deliveryAmount' }
                } },
            { $lookup: {
                    from: 'users',
                    localField: '_id.user',
                    foreignField: '_id',
                    as: 'userDetails'
                } },
            { $unwind: '$userDetails' },
            { $group: {
                    _id: '$_id.user',
                    name: { $first: '$userDetails.name' },
                    avatar: { $first: '$userDetails.avatar' },
                    stats: { $push: { status: '$_id.status', count: '$count', revenue: '$revenue' } },
                    totalProjects: { $sum: '$count' },
                    totalRevenue: { $sum: '$revenue' }
                } },
            { $sort: { totalRevenue: -1 } }
        ]);
        res.json(data);
    }
    catch (err) {
        console.error('Member perf error:', err);
        res.status(500).json({ error: 'Server error' });
    }
});
router.get('/revenue/timeline', async (req, res) => {
    try {
        const { months = 6 } = req.query;
        const since = new Date();
        since.setMonth(since.getMonth() - Number(months));
        const data = await Project_1.Project.aggregate([
            { $match: { status: 'Delivered', deliveredAt: { $gte: since } } },
            { $group: {
                    _id: { year: { $year: '$deliveredAt' }, month: { $month: '$deliveredAt' } },
                    revenue: { $sum: '$deliveryAmount' },
                    count: { $sum: 1 },
                } },
            { $sort: { '_id.year': 1, '_id.month': 1 } },
        ]);
        res.json(data);
    }
    catch {
        res.status(500).json({ error: 'Server error' });
    }
});
router.get('/reviews/stats', async (_req, res) => {
    try {
        const stats = await Review_1.Review.aggregate([
            { $match: { status: 'approved' } },
            { $group: {
                    _id: null,
                    avgRating: { $avg: '$rating' },
                    totalReviews: { $sum: 1 },
                    fiveStars: { $sum: { $cond: [{ $eq: ['$rating', 5] }, 1, 0] } },
                } },
        ]);
        res.json(stats[0] || { avgRating: 0, totalReviews: 0, fiveStars: 0 });
    }
    catch {
        res.status(500).json({ error: 'Server error' });
    }
});
exports.default = router;
//# sourceMappingURL=analytics.routes.js.map