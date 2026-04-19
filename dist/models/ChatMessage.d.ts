import mongoose, { Document } from 'mongoose';
export interface IChatMessage extends Document {
    sender: mongoose.Types.ObjectId;
    text: string;
    type: 'text' | 'image' | 'file';
    createdAt: Date;
}
export declare const ChatMessage: mongoose.Model<IChatMessage, {}, {}, {}, mongoose.Document<unknown, {}, IChatMessage, {}, mongoose.DefaultSchemaOptions> & IChatMessage & Required<{
    _id: mongoose.Types.ObjectId;
}> & {
    __v: number;
} & {
    id: string;
}, any, IChatMessage>;
//# sourceMappingURL=ChatMessage.d.ts.map