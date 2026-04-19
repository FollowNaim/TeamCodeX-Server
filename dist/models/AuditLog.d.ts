import mongoose, { Document, Types } from 'mongoose';
export interface IAuditLog extends Document {
    userId: Types.ObjectId;
    action: string;
    resourceType: string;
    resourceId: Types.ObjectId;
    changes: {
        before: Record<string, unknown>;
        after: Record<string, unknown>;
    };
    ip: string;
    userAgent: string;
    timestamp: Date;
}
export declare const AuditLog: mongoose.Model<IAuditLog, {}, {}, {}, mongoose.Document<unknown, {}, IAuditLog, {}, mongoose.DefaultSchemaOptions> & IAuditLog & Required<{
    _id: Types.ObjectId;
}> & {
    __v: number;
} & {
    id: string;
}, any, IAuditLog>;
//# sourceMappingURL=AuditLog.d.ts.map