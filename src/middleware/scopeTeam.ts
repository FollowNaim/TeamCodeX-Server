import { Response, NextFunction } from 'express';
import { AuthRequest } from './authenticate';
import { User } from '../models/User';
import mongoose from 'mongoose';

/**
 * scopeTeam middleware
 * Attaches `req.teamMemberIds` — an array of user IDs belonging to the same team.
 * - ops-manager: no restriction (teamMemberIds = null → all data)
 * - team-lead / co-lead: restricted to their team's members
 * - member: restricted to themselves only
 */
export const scopeTeam = async (req: AuthRequest, res: Response, next: NextFunction): Promise<void> => {
  try {
    const role = req.user?.role;

    if (role === 'ops-manager') {
      // No scoping — ops-manager sees everything
      (req as any).teamMemberIds = null;
      (req as any).teamId = null;
      return next();
    }

    const userId = req.user?.id;
    if (!userId) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }

    const user = await User.findById(userId).select('teamId role');
    if (!user?.teamId) {
      // User not in a team — restrict to self only
      (req as any).teamMemberIds = [new mongoose.Types.ObjectId(userId)];
      (req as any).teamId = null;
      return next();
    }

    const teamId = user.teamId;
    (req as any).teamId = teamId;

    if (role === 'team-lead' || role === 'co-lead') {
      // Get all members of this team
      const teamMembers = await User.find({ teamId }).select('_id');
      (req as any).teamMemberIds = teamMembers.map(m => m._id);
    } else {
      // Plain member — only themselves
      (req as any).teamMemberIds = [new mongoose.Types.ObjectId(userId)];
    }

    next();
  } catch {
    res.status(500).json({ error: 'Server error in team scope' });
  }
};
