import mongoose, { Document, Types } from 'mongoose';
export interface IMessage extends Document {
    projectId: Types.ObjectId;
    senderId: Types.ObjectId;
    content: string;
    attachments: string[];
    mentions: Types.ObjectId[];
    reactions: {
        emoji: string;
        userId: Types.ObjectId;
    }[];
}
export declare const Message: mongoose.Model<IMessage, {}, {}, {}, mongoose.Document<unknown, {}, IMessage, {}, mongoose.DefaultSchemaOptions> & IMessage & Required<{
    _id: Types.ObjectId;
}> & {
    __v: number;
} & {
    id: string;
}, any, IMessage>;
//# sourceMappingURL=Message.d.ts.map