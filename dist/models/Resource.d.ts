import mongoose, { Document, Types } from 'mongoose';
export interface IResource extends Document {
    title: string;
    type: 'file' | 'link' | 'sheet' | 'credential';
    url: string;
    encryptedContent?: string;
    iv?: string;
    category: string;
    tags: string[];
    visibleTo: 'all' | Types.ObjectId[];
    uploadedBy: Types.ObjectId;
}
export declare const Resource: mongoose.Model<IResource, {}, {}, {}, mongoose.Document<unknown, {}, IResource, {}, mongoose.DefaultSchemaOptions> & IResource & Required<{
    _id: Types.ObjectId;
}> & {
    __v: number;
} & {
    id: string;
}, any, IResource>;
//# sourceMappingURL=Resource.d.ts.map