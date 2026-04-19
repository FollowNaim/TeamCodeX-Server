import mongoose, { Document, Schema, Types } from 'mongoose';

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

const noticeSchema = new Schema<INotice>(
  {
    title: { type: String, required: true, trim: true },
    content: { type: String, required: true },
    category: { type: String, enum: ['announcement', 'urgent', 'event', 'general'], default: 'general' },
    isPinned: { type: Boolean, default: false },
    isUrgent: { type: Boolean, default: false },
    attachments: [String],
    readBy: [{ type: Schema.Types.ObjectId, ref: 'User' }],
    comments: [
      {
        userId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
        text: { type: String, required: true },
        createdAt: { type: Date, default: Date.now },
      },
    ],
    createdBy: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    expiresAt: Date,
  },
  { timestamps: true }
);

export const Notice = mongoose.model<INotice>('Notice', noticeSchema);
