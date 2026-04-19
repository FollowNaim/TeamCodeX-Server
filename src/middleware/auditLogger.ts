import { Response, NextFunction } from 'express';
import { AuditLog } from '../models/AuditLog';
import { AuthRequest } from './authenticate';

export const auditLogger = (action: string, resourceType: string) => {
  return async (req: AuthRequest, res: Response, next: NextFunction): Promise<void> => {
    const originalJson = res.json.bind(res);
    res.json = (body) => {
      if (req.user && res.statusCode < 400) {
        const resourceId = req.params.id || body?._id || body?.data?._id;
        if (resourceId) {
          AuditLog.create({
            userId: req.user.id,
            action,
            resourceType,
            resourceId,
            changes: { before: {}, after: req.body },
            ip: req.ip || '',
            userAgent: req.headers['user-agent'] || '',
          }).catch(console.error);
        }
      }
      return originalJson(body);
    };
    next();
  };
};
