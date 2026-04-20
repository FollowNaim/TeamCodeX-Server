import { Router, Response } from 'express';
import { Team } from '../models/Team';
import { User } from '../models/User';
import { Project } from '../models/Project';
import { Permission } from '../models/Permission';
import { authenticate, AuthRequest } from '../middleware/authenticate';
import { requireOpsManager, requireLeadership, isOpsManager } from '../middleware/authorize';
import mongoose from 'mongoose';

const router = Router();
router.use(authenticate);

// GET /api/teams — ops-manager: all teams; leaders: own team
router.get('/', requireLeadership(), async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    if (isOpsManager(req)) {
      const teams = await Team.find({ isActive: true })
        .populate('leaderId', 'name avatar email')
        .populate('coLeaderIds', 'name avatar')
        .populate('memberIds', 'name avatar role')
        .sort({ name: 1 });
      res.json(teams);
    } else {
      // team-lead or co-lead — return only their team
      const user = await User.findById(req.user?.id).select('teamId');
      if (!user?.teamId) { res.json([]); return; }
      const team = await Team.findById(user.teamId)
        .populate('leaderId', 'name avatar email')
        .populate('coLeaderIds', 'name avatar')
        .populate('memberIds', 'name avatar role');
      res.json(team ? [team] : []);
    }
  } catch { res.status(500).json({ error: 'Server error' }); }
});

// GET /api/teams/my — own team info for leaders
router.get('/my', requireLeadership(), async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const user = await User.findById(req.user?.id).select('teamId');
    if (!user?.teamId) { res.status(404).json({ error: 'Not assigned to a team' }); return; }
    const team = await Team.findById(user.teamId)
      .populate('leaderId', 'name avatar email')
      .populate('coLeaderIds', 'name avatar email')
      .populate('memberIds', 'name avatar role email isActive');
    res.json(team);
  } catch { res.status(500).json({ error: 'Server error' }); }
});

// GET /api/teams/:id — ops-manager only detail
router.get('/:id', requireOpsManager(), async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const team = await Team.findById(req.params.id)
      .populate('leaderId', 'name avatar email role')
      .populate('coLeaderIds', 'name avatar email role')
      .populate('memberIds', 'name avatar role email isActive isApproved');
    if (!team) { res.status(404).json({ error: 'Team not found' }); return; }
    res.json(team);
  } catch { res.status(500).json({ error: 'Server error' }); }
});

// GET /api/teams/:id/stats — per-team analytics for ops-manager
router.get('/:id/stats', requireOpsManager(), async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const team = await Team.findById(req.params.id);
    if (!team) { res.status(404).json({ error: 'Team not found' }); return; }
    const allMemberIds = [team.leaderId, ...team.coLeaderIds, ...team.memberIds].filter(Boolean);

    const projects = await Project.find({ assignedUsers: { $in: allMemberIds } });
    const delivered = projects.filter(p => p.status === 'Delivered');
    const wip = projects.filter(p => p.status === 'WIP');
    const totalRevenue = delivered.reduce((s, p) => s + (p.price * 0.8), 0);
    const totalWIPValue = wip.reduce((s, p) => s + (p.deliveryAmount || 0), 0);

    res.json({
      teamId: team._id,
      teamName: team.name,
      memberCount: allMemberIds.length,
      totalProjects: projects.length,
      totalRevenue,
      totalWIPValue,
      byStatus: {
        WIP: wip.length,
        Delivered: delivered.length,
        Revision: projects.filter(p => p.status === 'Revision').length,
        Cancelled: projects.filter(p => p.status === 'Cancelled').length,
      },
    });
  } catch { res.status(500).json({ error: 'Server error' }); }
});

// POST /api/teams — create team (ops-manager only)
router.post('/', requireOpsManager(), async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { name, description, leaderId, coLeaderIds, memberIds } = req.body;
    const team = await Team.create({ name, description: description || '', leaderId, coLeaderIds: coLeaderIds || [], memberIds: memberIds || [] });

    // Assign teamId on all referenced users
    const allIds = [leaderId, ...(coLeaderIds || []), ...(memberIds || [])].filter(Boolean);
    if (allIds.length) await User.updateMany({ _id: { $in: allIds } }, { teamId: team._id });
    if (leaderId) await User.findByIdAndUpdate(leaderId, { role: 'team-lead' });

    const populated = await team.populate([
      { path: 'leaderId', select: 'name avatar email' },
      { path: 'coLeaderIds', select: 'name avatar' },
      { path: 'memberIds', select: 'name avatar role' },
    ]);
    res.status(201).json(populated);
  } catch (err: any) { res.status(400).json({ error: err.message }); }
});

// PATCH /api/teams/:id — update team (ops-manager only)
router.patch('/:id', requireOpsManager(), async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { name, description, leaderId, coLeaderIds, memberIds, isActive } = req.body;
    const team = await Team.findById(req.params.id);
    if (!team) { res.status(404).json({ error: 'Team not found' }); return; }

    if (name) team.name = name;
    if (description !== undefined) team.description = description;
    if (isActive !== undefined) team.isActive = isActive;

    // Handle leader change
    if (leaderId !== undefined) {
      if (team.leaderId) await User.findByIdAndUpdate(team.leaderId, { role: 'member' });
      team.leaderId = leaderId ? new mongoose.Types.ObjectId(leaderId) : undefined;
      if (leaderId) await User.findByIdAndUpdate(leaderId, { role: 'team-lead', teamId: team._id });
    }

    // Handle co-leaders
    if (coLeaderIds !== undefined) {
      // Remove old co-lead roles
      if (team.coLeaderIds.length) await User.updateMany({ _id: { $in: team.coLeaderIds } }, { role: 'member' });
      team.coLeaderIds = coLeaderIds.map((id: string) => new mongoose.Types.ObjectId(id));
      if (coLeaderIds.length) await User.updateMany({ _id: { $in: coLeaderIds } }, { role: 'co-lead', teamId: team._id });
    }

    // Handle members
    if (memberIds !== undefined) {
      // Clear old member teamIds
      const oldMemberIds = team.memberIds.filter(id => !memberIds.includes(id.toString()));
      if (oldMemberIds.length) await User.updateMany({ _id: { $in: oldMemberIds } }, { $unset: { teamId: '' } });
      team.memberIds = memberIds.map((id: string) => new mongoose.Types.ObjectId(id));
      if (memberIds.length) await User.updateMany({ _id: { $in: memberIds } }, { teamId: team._id });
    }

    await team.save();
    const populated = await team.populate([
      { path: 'leaderId', select: 'name avatar email' },
      { path: 'coLeaderIds', select: 'name avatar' },
      { path: 'memberIds', select: 'name avatar role' },
    ]);
    res.json(populated);
  } catch (err: any) { res.status(400).json({ error: err.message }); }
});

// DELETE /api/teams/:id
router.delete('/:id', requireOpsManager(), async (_req, res: Response): Promise<void> => {
  try {
    await Team.findByIdAndUpdate(_req.params.id, { isActive: false });
    res.json({ message: 'Team deactivated' });
  } catch { res.status(500).json({ error: 'Server error' }); }
});

// POST /api/teams/:id/members — add member
router.post('/:id/members', requireLeadership(), async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { userId } = req.body;
    const team = await Team.findById(req.params.id);
    if (!team) { res.status(404).json({ error: 'Team not found' }); return; }

    // Non-ops-manager leaders can only modify their own team
    if (req.user?.role !== 'ops-manager') {
      const reqUser = await User.findById(req.user?.id).select('teamId');
      if (reqUser?.teamId?.toString() !== req.params.id) {
        res.status(403).json({ error: 'Forbidden: not your team' }); return;
      }
    }

    if (!team.memberIds.includes(new mongoose.Types.ObjectId(userId))) {
      team.memberIds.push(new mongoose.Types.ObjectId(userId));
      await team.save();
    }
    await User.findByIdAndUpdate(userId, { teamId: team._id, isApproved: true });
    res.json({ message: 'Member added' });
  } catch { res.status(500).json({ error: 'Server error' }); }
});

// DELETE /api/teams/:id/members/:uid — remove member
router.delete('/:id/members/:uid', requireLeadership(), async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const team = await Team.findById(req.params.id);
    if (!team) { res.status(404).json({ error: 'Team not found' }); return; }

    if (req.user?.role !== 'ops-manager') {
      const reqUser = await User.findById(req.user?.id).select('teamId');
      if (reqUser?.teamId?.toString() !== req.params.id) {
        res.status(403).json({ error: 'Forbidden: not your team' }); return;
      }
    }

    team.memberIds = team.memberIds.filter(id => id.toString() !== req.params.uid);
    await team.save();
    await User.findByIdAndUpdate(req.params.uid, { $unset: { teamId: '' } });
    res.json({ message: 'Member removed' });
  } catch { res.status(500).json({ error: 'Server error' }); }
});

// GET /api/teams/all/stats — aggregated stats for ALL teams (ops-manager dashboard)
router.get('/all/stats', requireOpsManager(), async (_req, res: Response): Promise<void> => {
  try {
    const teams = await Team.find({ isActive: true });
    const teamStats = await Promise.all(teams.map(async team => {
      const allMemberIds = [team.leaderId, ...team.coLeaderIds, ...team.memberIds].filter(Boolean);
      const projects = await Project.find({ assignedUsers: { $in: allMemberIds } });
      const delivered = projects.filter(p => p.status === 'Delivered');
      return {
        teamId: team._id,
        teamName: team.name,
        memberCount: allMemberIds.length,
        totalProjects: projects.length,
        totalRevenue: delivered.reduce((s, p) => s + (p.price * 0.8), 0),
        delivered: delivered.length,
        wip: projects.filter(p => p.status === 'WIP').length,
      };
    }));
    res.json(teamStats);
  } catch { res.status(500).json({ error: 'Server error' }); }
});

// GET /api/teams/pending-users — users not yet in any team (ops-manager)
router.get('/pending-users', requireOpsManager(), async (_req, res: Response): Promise<void> => {
  try {
    const users = await User.find({ teamId: null, isActive: true }).select('name email role avatar isApproved');
    res.json(users);
  } catch { res.status(500).json({ error: 'Server error' }); }
});

export default router;
