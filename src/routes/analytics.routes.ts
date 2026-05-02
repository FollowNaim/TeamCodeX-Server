import { Router, Response } from 'express';
import { Project } from '../models/Project';
import { User } from '../models/User';
import { Review } from '../models/Review';
import { authenticate, AuthRequest } from '../middleware/authenticate';
import { authorize } from '../middleware/authorize';
import mongoose from 'mongoose';

const router = Router();

const getDateFilter = (monthQuery: any, defaultToPrevious = false) => {
  let startDate: Date, endDate: Date;
  const now = new Date();
  
  try {
    if (monthQuery && typeof monthQuery === 'string' && monthQuery.includes('-')) {
      const [year, month] = monthQuery.split('-');
      const y = parseInt(year);
      const m = parseInt(month);
      if (!isNaN(y) && !isNaN(m)) {
        startDate = new Date(y, m - 1, 1);
        endDate = new Date(y, m, 0, 23, 59, 59, 999);
      } else {
        throw new Error('Invalid date parts');
      }
    } else {
      const target = new Date(now.getFullYear(), now.getMonth(), 1);
      if (defaultToPrevious) target.setMonth(target.getMonth() - 1);
      startDate = new Date(target.getFullYear(), target.getMonth(), 1);
      endDate = new Date(target.getFullYear(), target.getMonth() + 1, 0, 23, 59, 59, 999);
    }
  } catch (err) {
    startDate = new Date(now.getFullYear(), now.getMonth(), 1);
    endDate = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999);
  }
  
  return { startDate, endDate };
};

const isCurrentMonth = (startDate: Date) => {
  const now = new Date();
  return startDate.getMonth() === now.getMonth() && startDate.getFullYear() === now.getFullYear();
};

const getMongoDateFilter = (startDate: Date, endDate: Date) => {
  const isCurrent = isCurrentMonth(startDate);
  return {
    $or: [
      ...(isCurrent ? [{ status: 'WIP' }] : []),
      { incomingDate: { $gte: startDate, $lte: endDate } },
      { deliveredAt: { $gte: startDate, $lte: endDate } },
      { updatedAt: { $gte: startDate, $lte: endDate }, status: { $in: ['Delivered', 'Cancelled'] } }
    ]
  };
};

router.get('/public', async (req, res: Response): Promise<void> => {
  try {
    const { startDate, endDate } = getDateFilter(req.query.month, true);
    const mongoFilter = getMongoDateFilter(startDate, endDate);

    const projectStats = await Project.aggregate([
      { $match: mongoFilter },
      { $group: { _id: null, totalProjects: { $sum: 1 }, totalRevenue: { $sum: { $multiply: ['$price', 0.8] } } } }
    ]);
    const topPerformers = await Project.aggregate([
      { $match: { status: 'Delivered', incomingDate: { $gte: startDate, $lte: endDate } } },
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
    const { startDate, endDate } = getDateFilter(req.query.month);
    const mongoFilter = getMongoDateFilter(startDate, endDate);

    let projects: any[] = [];
    try {
      projects = await Project.find(mongoFilter).lean();
    } catch (err) {
      console.error('Project fetch error:', err);
    }

    let users = 0;
    try {
      users = await User.countDocuments({ isActive: true });
      if (users === 0) {
        // Fallback: count all users if isActive query fails or returns 0 unexpectedly
        users = await User.countDocuments({});
      }
    } catch (err) {
      console.error('User fetch error:', err);
    }

    const delivered = projects.filter(p => p.status === 'Delivered');
    const totalRevenue = delivered.reduce((s, p) => s + ((p.price || 0) * 0.8), 0);
    
    let avgDeliveryMs = 0;
    const deliveredWithDates = delivered.filter(p => p.deliveredAt && p.createdAt);
    if (deliveredWithDates.length > 0) {
      const totalMs = deliveredWithDates.reduce((s, p) => {
        return s + (new Date(p.deliveredAt!).getTime() - new Date(p.createdAt).getTime());
      }, 0);
      avgDeliveryMs = totalMs / deliveredWithDates.length;
    }

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
  } catch (err) { 
    console.error('Overview error:', err);
    res.status(500).json({ error: 'Server error' }); 
  }
});

router.get('/team-breakdown', async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { startDate, endDate } = getDateFilter(req.query.month);
    const mongoFilter = getMongoDateFilter(startDate, endDate);

    const data = await User.aggregate([
      { $match: { isActive: true } },
      { $lookup: {
        from: 'projects',
        let: { userId: '$_id' },
        pipeline: [
          { $match: {
            $expr: { $in: ['$$userId', '$assignedUsers'] },
            ...mongoFilter
          }}
        ],
        as: 'userProjects'
      }},
      { $unwind: { path: '$userProjects', preserveNullAndEmptyArrays: true } },
      { $addFields: {
        memberCount: { $cond: [
          { $and: [{ $ifNull: ['$userProjects.assignedUsers', false] }, { $gt: [{ $size: { $ifNull: ['$userProjects.assignedUsers', []] } }, 0] }] },
          { $size: '$userProjects.assignedUsers' },
          1
        ]}
      }},
      { $group: {
        _id: { user: '$_id', status: '$userProjects.status' },
        name: { $first: '$name' },
        avatar: { $first: '$avatar' },
        email: { $first: '$email' },
        count: { $sum: { $cond: [{ $ifNull: ['$userProjects', false] }, 1, 0] } },
        value: { $sum: { 
          $cond: [
            { $ifNull: ['$userProjects', false] },
            { $divide: [
              { $cond: [{ $eq: ['$userProjects.status', 'WIP'] }, { $ifNull: ['$userProjects.deliveryAmount', 0] }, { $multiply: [{ $ifNull: ['$userProjects.price', 0] }, 0.8] }] },
              '$memberCount'
            ]},
            0
          ]
        }}
      }},
      { $group: {
        _id: '$_id.user',
        name: { $first: '$name' },
        avatar: { $first: '$avatar' },
        email: { $first: '$email' },
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
  } catch (err) { 
    console.error(err);
    res.status(500).json({ error: 'Server error' }); 
  }
});

router.get('/me', async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const userId = req.user?.id;
    if (!userId) { res.status(401).json({ error: 'Unauthorized' }); return; }
    
    const { startDate, endDate } = getDateFilter(req.query.month);
    const allProjects = await Project.find({ assignedUsers: new mongoose.Types.ObjectId(userId) });
    
    const projects = allProjects.filter(p => {
      if (isCurrentMonth(startDate) && p.status === 'WIP') return true;
      return p.incomingDate >= startDate && p.incomingDate <= endDate;
    });

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

router.get('/leaderboard', async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { startDate, endDate } = getDateFilter(req.query.month);
    const leaderboard = await Project.aggregate([
      { $match: { 
        status: 'Delivered', 
        deliveredAt: { $gte: startDate, $lte: endDate } 
      } },
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

router.get('/projects/status', async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { startDate, endDate } = getDateFilter(req.query.month);
    const mongoFilter = getMongoDateFilter(startDate, endDate);
    const data = await Project.aggregate([
      { $match: mongoFilter },
      { $group: { _id: '$status', count: { $sum: 1 }, revenue: { $sum: { $multiply: ['$price', 0.8] } } } },
    ]);
    res.json(data);
  } catch { res.status(500).json({ error: 'Server error' }); }
});

router.get('/projects/profile', async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { startDate, endDate } = getDateFilter(req.query.month);
    const mongoFilter = getMongoDateFilter(startDate, endDate);
    const data = await Project.aggregate([
      { $match: mongoFilter },
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

router.get('/members/performance', async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { startDate, endDate } = getDateFilter(req.query.month);
    const mongoFilter = getMongoDateFilter(startDate, endDate);

    const data = await User.aggregate([
      { $match: { isActive: true } },
      { $lookup: {
        from: 'projects',
        let: { userId: '$_id' },
        pipeline: [
          { $match: {
            $expr: { $in: ['$$userId', '$assignedUsers'] },
            ...mongoFilter
          }}
        ],
        as: 'userProjects'
      }},
      { $unwind: { path: '$userProjects', preserveNullAndEmptyArrays: true } },
      { $addFields: {
        memberCount: { $cond: [
          { $and: [{ $ifNull: ['$userProjects.assignedUsers', false] }, { $gt: [{ $size: { $ifNull: ['$userProjects.assignedUsers', []] } }, 0] }] },
          { $size: '$userProjects.assignedUsers' },
          1
        ]}
      }},
      { $group: {
        _id: { user: '$_id', status: '$userProjects.status' },
        name: { $first: '$name' },
        avatar: { $first: '$avatar' },
        count: { $sum: { $cond: [{ $ifNull: ['$userProjects', false] }, 1, 0] } },
        revenue: { $sum: { 
          $cond: [
            { $ifNull: ['$userProjects', false] },
            { $divide: [{ $multiply: [{ $ifNull: ['$userProjects.price', 0] }, 0.8] }, '$memberCount'] },
            0
          ]
        }}
      }},
      { $group: {
        _id: '$_id.user',
        name: { $first: '$name' },
        avatar: { $first: '$avatar' },
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
      { $match: { status: 'Delivered', incomingDate: { $gte: since } } },
      { $group: {
        _id: { year: { $year: '$incomingDate' }, month: { $month: '$incomingDate' } },
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
