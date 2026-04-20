import { Response, NextFunction } from 'express';
import { AuthRequest, UserRole } from './authenticate';

export const authorize = (...roles: UserRole[]) => {
  return (req: AuthRequest, res: Response, next: NextFunction): void => {
    if (!req.user || !roles.includes(req.user.role)) {
      res.status(403).json({ error: 'Forbidden: insufficient permissions' });
      return;
    }
    next();
  };
};

// Shorthand: ops-manager only
export const requireOpsManager = () => authorize('ops-manager');

// Shorthand: leadership tiers (not plain members)
export const requireLeadership = () => authorize('ops-manager', 'team-lead', 'co-lead');

// Helper: is user ops-manager?
export const isOpsManager = (req: AuthRequest): boolean => req.user?.role === 'ops-manager';

// Helper: is user a leadership role (team-lead or co-lead)?
export const isLeadership = (req: AuthRequest): boolean =>
  req.user?.role === 'team-lead' || req.user?.role === 'co-lead' || req.user?.role === 'ops-manager';

// Helper: is user a plain member?
export const isMember = (req: AuthRequest): boolean => req.user?.role === 'member';
