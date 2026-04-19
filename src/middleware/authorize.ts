import { Response, NextFunction } from 'express';
import { AuthRequest } from './authenticate';

export const authorize = (...roles: ('team-lead' | 'co-lead' | 'member')[]) => {
  return (req: AuthRequest, res: Response, next: NextFunction): void => {
    if (!req.user || !roles.includes(req.user.role)) {
      res.status(403).json({ error: 'Forbidden: insufficient permissions' });
      return;
    }
    next();
  };
};
