import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { env } from '../config/env';

export type UserRole = 'ops-manager' | 'team-lead' | 'co-lead' | 'member';

export interface ResolvedPermissions {
  canViewAnalytics: boolean;
  canViewAllMembers: boolean;
  canManageProjects: boolean;
  canViewCrossTeam: boolean;
  canManageMembers: boolean;
  canAccessBazuka: boolean;
}

export interface AuthRequest extends Request {
  user?: {
    id: string;
    role: UserRole;
    email: string;
    teamId?: string;
    badges?: string[];
    permissions?: ResolvedPermissions;
  };
}

export const authenticate = (req: AuthRequest, res: Response, next: NextFunction): void => {
  const authHeader = req.headers.authorization;
  if (!authHeader?.startsWith('Bearer ')) {
    res.status(401).json({ error: 'No token provided' });
    return;
  }
  const token = authHeader.split(' ')[1];
  try {
    const decoded = jwt.verify(token, env.JWT_SECRET) as {
      id: string;
      role: UserRole;
      email: string;
      teamId?: string;
      badges?: string[];
      permissions?: ResolvedPermissions;
    };
    req.user = decoded;
    next();
  } catch {
    res.status(401).json({ error: 'Invalid or expired token' });
  }
};
