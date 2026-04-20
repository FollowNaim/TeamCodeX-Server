import { Router, Response } from 'express';
import { Project } from '../models/Project';
import { User } from '../models/User';
import { Review } from '../models/Review';
import { authenticate, AuthRequest } from '../middleware/authenticate';
import { authorize } from '../middleware/authorize';
import mongoose from 'mongoose';

const router = Router();

router.get('/public', async (_req, res: Response): Promise<void> => {
  try {
    const projectStats = await Project.aggregate([
      { $group: { _id: null, totalProjects: { $sum: 1 }, totalRevenue: { $sum: { $multiply: ['$price', 0.8] } } } }
    ]);
    const topPerformers = await Project.aggregate([
      { $match: { status: 'Delivered' } },
      { $addFields: { 
        memberCount: { $cond: [{ $gt: [{ $size: '$assignedUsers' }, 0] }, { $size: '$assignedUsers' }, 1] } 
      }},
      { $unwind: '$assignedUsers' },
      { $group: { 
        _id: '$assignedUsers', 
        totalRevenue: { $sum: { $divide: [{ $multiply: ['$price', 0.8] }, '$memberCount'] } }, 
        projectsDelivered: { $sum: 1 } 
      }},
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
  } catch (err: unknown) {
    const e = err as Error;
    res.status(500).json({ error: e.message });
  }
});

router.use(authenticate);

router.get('/overview', async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const [projects, users] = await Promise.all([
      Project.find(),
      User.countDocuments({ isActive: true }),
    ]);
    const delivered = projects.filter(p => p.status === 'Delivered');
    const totalRevenue = delivered.reduce((s, p) => s + (p.price * 0.8), 0);
    const avgDeliveryMs = delivered.filter(p => p.deliveredAt).reduce((s, p) => {
      return s + (p.deliveredAt!.getTime() - p.createdAt.getTime());
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
  } catch { res.status(500).json({ error: 'Server error' }); }
});

router.get('/team-breakdown', async (_req, res: Response): Promise<void> => {
  try {
    const data = await Project.aggregate([
      { $addFields: { 
        memberCount: { $cond: [{ $gt: [{ $size: '$assignedUsers' }, 0] }, { $size: '$assignedUsers' }, 1] } 
      }},
      { $unwind: '$assignedUsers' },
      { $group: {
        _id: { user: '$assignedUsers', status: '$status' },
        count: { $sum: 1 },
        value: { $sum: { 
          $divide: [
            { $cond: [{ $eq: ['$status', 'WIP'] }, '$deliveryAmount', { $multiply: ['$price', 0.8] }] },
            '$memberCount'
          ]
        }}
      }},
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
      }},
      { $sort: { total: -1 } }
    ]);
    res.json(data);
  } catch { res.status(500).json({ error: 'Server error' }); }
});

router.get('/me', async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const userId = req.user?.id;
    if (!userId) { res.status(401).json({ error: 'Unauthorized' }); return; }
    
    const projects = await Project.find({ assignedUsers: new mongoose.Types.ObjectId(userId) });
    const delivered = projects.filter(p => p.status === 'Delivered');
    const totalRevenue = delivered.reduce((sum, p) => {
      const count = p.assignedUsers.length || 1;
      return sum + ((p.price * 0.8) / count);
    }, 0);
    
    const reviews = await Review.find({ submittedBy: userId, status: 'approved' });
    const avgRating = reviews.length ? reviews.reduce((s, r) => s + r.rating, 0) / reviews.length : 0;

    const wipProjects = projects.filter(p => p.status === 'WIP');
    const totalWIPValue = wipProjects.reduce((sum, p) => {
      const count = p.assignedUsers.length || 1;
      return sum + ((p.deliveryAmount || 0) / count);
    }, 0);

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
  } catch { res.status(500).json({ error: 'Server error' }); }
});

router.get('/leaderboard', async (_req, res: Response): Promise<void> => {
  try {
    const leaderboard = await Project.aggregate([
      { $match: { status: 'Delivered' } },
      { $addFields: { 
        memberCount: { $cond: [{ $gt: [{ $size: '$assignedUsers' }, 0] }, { $size: '$assignedUsers' }, 1] } 
      }},
      { $unwind: '$assignedUsers' },
      { $group: {
        _id: '$assignedUsers',
        projectsDelivered: { $sum: 1 },
        totalRevenue: { $sum: { $divide: [{ $multiply: ['$price', 0.8] }, '$memberCount'] } },
      }},
      { $sort: { totalRevenue: -1 } },
      { $limit: 10 },
      { $lookup: { from: 'users', localField: '_id', foreignField: '_id', as: 'user' } },
      { $unwind: '$user' },
      { $project: { 'user.passwordHash': 0 } },
    ]);
    res.json(leaderboard);
  } catch { res.status(500).json({ error: 'Server error' }); }
});

router.get('/projects/status', async (_req, res: Response): Promise<void> => {
  try {
    const data = await Project.aggregate([
      { $group: { _id: '$status', count: { $sum: 1 }, revenue: { $sum: { $multiply: ['$price', 0.8] } } } },
    ]);
    res.json(data);
  } catch { res.status(500).json({ error: 'Server error' }); }
});

router.get('/projects/profile', async (_req, res: Response): Promise<void> => {
  try {
    const data = await Project.aggregate([
      { $group: {
        _id: '$profileName',
        count: { $sum: 1 },
        revenue: { $sum: { $multiply: ['$price', 0.8] } }
      }},
      { $sort: { revenue: -1 } }
    ]);
    res.json(data);
  } catch { res.status(500).json({ error: 'Server error' }); }
});

router.get('/members/performance', async (_req: AuthRequest, res: Response): Promise<void> => {
  try {
    const data = await Project.aggregate([
      { $addFields: { 
        memberCount: { $cond: [{ $gt: [{ $size: '$assignedUsers' }, 0] }, { $size: '$assignedUsers' }, 1] } 
      }},
      { $unwind: '$assignedUsers' },
      { $group: {
        _id: { user: '$assignedUsers', status: '$status' },
        count: { $sum: 1 },
        revenue: { $sum: { 
          $divide: [{ $multiply: ['$price', 0.8] }, '$memberCount']
        }}
      }},
      { $lookup: {
        from: 'users',
        localField: '_id.user',
        foreignField: '_id',
        as: 'userDetails'
      }},
      { $unwind: '$userDetails' },
      { $group: {
        _id: '$_id.user',
        name: { $first: '$userDetails.name' },
        avatar: { $first: '$userDetails.avatar' },
        stats: { $push: { status: '$_id.status', count: '$count', revenue: '$revenue' } },
        totalProjects: { $sum: '$count' },
        totalRevenue: { $sum: '$revenue' }
      }},
      { $sort: { totalRevenue: -1 } }
    ]);
    res.json(data);
  } catch (err) { 
    console.error('Member perf error:', err);
    res.status(500).json({ error: 'Server error' }); 
  }
});

router.get('/revenue/timeline', async (req, res: Response): Promise<void> => {
  try {
    const { months = 6 } = req.query;
    const since = new Date();
    since.setMonth(since.getMonth() - Number(months));
    const data = await Project.aggregate([
      { $match: { status: 'Delivered', deliveredAt: { $gte: since } } },
      { $group: {
        _id: { year: { $year: '$deliveredAt' }, month: { $month: '$deliveredAt' } },
        revenue: { $sum: { $multiply: ['$price', 0.8] } },
        count: { $sum: 1 },
      }},
      { $sort: { '_id.year': 1, '_id.month': 1 } },
    ]);
    res.json(data);
  } catch { res.status(500).json({ error: 'Server error' }); }
});

router.get('/reviews/stats', async (_req, res: Response): Promise<void> => {
  try {
    const stats = await Review.aggregate([
      { $match: { status: 'approved' } },
      { $group: {
        _id: null,
        avgRating: { $avg: '$rating' },
        totalReviews: { $sum: 1 },
        fiveStars: { $sum: { $cond: [{ $eq: ['$rating', 5] }, 1, 0] } },
      }},
    ]);
    res.json(stats[0] || { avgRating: 0, totalReviews: 0, fiveStars: 0 });
  } catch { res.status(500).json({ error: 'Server error' }); }
});

export default router;
