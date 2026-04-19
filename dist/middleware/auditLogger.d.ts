import { Response, NextFunction } from 'express';
import { AuthRequest } from './authenticate';
export declare const auditLogger: (action: string, resourceType: string) => (req: AuthRequest, res: Response, next: NextFunction) => Promise<void>;
//# sourceMappingURL=auditLogger.d.ts.map