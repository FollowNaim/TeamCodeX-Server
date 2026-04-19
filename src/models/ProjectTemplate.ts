import mongoose, { Document, Schema, Types } from 'mongoose';

export interface IProjectTemplate extends Document {
  name: string;
  description: string;
  defaultSubtasks: { title: string; order: number }[];
  defaultTags: string[];
  estimatedDays: number;
  createdBy: Types.ObjectId;
}

const projectTemplateSchema = new Schema<IProjectTemplate>(
  {
    name: { type: String, required: true, trim: true },
    description: { type: String, default: '' },
    defaultSubtasks: [
      {
        title: { type: String, required: true },
        order: { type: Number, default: 0 },
      },
    ],
    defaultTags: [String],
    estimatedDays: { type: Number, default: 7 },
    createdBy: { type: Schema.Types.ObjectId, ref: 'User', required: true },
  },
  { timestamps: true }
);

export const ProjectTemplate = mongoose.model<IProjectTemplate>('ProjectTemplate', projectTemplateSchema);
