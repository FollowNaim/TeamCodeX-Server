import { Request, Response, NextFunction } from 'express';
export interface AuthRequest extends Request {
    user?: {
        id: string;
        role: 'team-lead' | 'co-lead' | 'member';
        email: string;
        badges?: string[];
    };
}
export declare const authenticate: (req: AuthRequest, res: Response, next: NextFunction) => void;
//# sourceMappingURL=authenticate.d.ts.map