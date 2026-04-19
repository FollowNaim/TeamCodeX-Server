import mongoose, { Document, Schema, Types } from 'mongoose';

export interface IMessage extends Document {
  projectId: Types.ObjectId;
  senderId: Types.ObjectId;
  content: string;
  attachments: string[];
  mentions: Types.ObjectId[];
  reactions: { emoji: string; userId: Types.ObjectId }[];
}

const messageSchema = new Schema<IMessage>(
  {
    projectId: { type: Schema.Types.ObjectId, ref: 'Project', required: true },
    senderId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    content: { type: String, required: true },
    attachments: [String],
    mentions: [{ type: Schema.Types.ObjectId, ref: 'User' }],
    reactions: [
      {
        emoji: String,
        userId: { type: Schema.Types.ObjectId, ref: 'User' },
      },
    ],
  },
  { timestamps: true }
);

messageSchema.index({ projectId: 1, createdAt: -1 });

export const Message = mongoose.model<IMessage>('Message', messageSchema);
