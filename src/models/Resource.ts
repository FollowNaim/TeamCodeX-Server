import mongoose, { Document, Schema, Types } from 'mongoose';

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

const resourceSchema = new Schema<IResource>(
  {
    title: { type: String, required: true, trim: true },
    type: { type: String, enum: ['file', 'link', 'sheet', 'credential'], required: true },
    url: { type: String, default: '' },
    encryptedContent: String,
    iv: String,
    category: { type: String, default: 'General' },
    tags: [String],
    visibleTo: { type: Schema.Types.Mixed, default: 'all' },
    uploadedBy: { type: Schema.Types.ObjectId, ref: 'User', required: true },
  },
  { timestamps: true }
);

export const Resource = mongoose.model<IResource>('Resource', resourceSchema);
