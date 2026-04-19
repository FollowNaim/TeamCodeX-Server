import { Response, NextFunction } from 'express';
import { AuthRequest } from './authenticate';
export declare const authorize: (...roles: ("team-lead" | "co-lead" | "member")[]) => (req: AuthRequest, res: Response, next: NextFunction) => void;
//# sourceMappingURL=authorize.d.ts.map