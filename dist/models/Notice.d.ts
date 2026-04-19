import mongoose, { Document, Types } from 'mongoose';
export interface INoticeComment {
    _id: Types.ObjectId;
    userId: Types.ObjectId;
    text: string;
    createdAt: Date;
}
export interface INotice extends Document {
    title: string;
    content: string;
    category: 'announcement' | 'urgent' | 'event' | 'general';
    isPinned: boolean;
    isUrgent: boolean;
    attachments: string[];
    readBy: Types.ObjectId[];
    comments: INoticeComment[];
    createdBy: Types.ObjectId;
    expiresAt?: Date;
}
export declare const Notice: mongoose.Model<INotice, {}, {}, {}, mongoose.Document<unknown, {}, INotice, {}, mongoose.DefaultSchemaOptions> & INotice & Required<{
    _id: Types.ObjectId;
}> & {
    __v: number;
} & {
    id: string;
}, any, INotice>;
//# sourceMappingURL=Notice.d.ts.map