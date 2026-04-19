import mongoose, { Document, Types } from 'mongoose';
export interface IProjectTemplate extends Document {
    name: string;
    description: string;
    defaultSubtasks: {
        title: string;
        order: number;
    }[];
    defaultTags: string[];
    estimatedDays: number;
    createdBy: Types.ObjectId;
}
export declare const ProjectTemplate: mongoose.Model<IProjectTemplate, {}, {}, {}, mongoose.Document<unknown, {}, IProjectTemplate, {}, mongoose.DefaultSchemaOptions> & IProjectTemplate & Required<{
    _id: Types.ObjectId;
}> & {
    __v: number;
} & {
    id: string;
}, any, IProjectTemplate>;
//# sourceMappingURL=ProjectTemplate.d.ts.map