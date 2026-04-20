import mongoose, { Document, Schema, Types } from 'mongoose';

export interface ITeam extends Document {
  name: string;
  description: string;
  leaderId?: Types.ObjectId;
  coLeaderIds: Types.ObjectId[];
  memberIds: Types.ObjectId[];
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const teamSchema = new Schema<ITeam>(
  {
    name: { type: String, required: true, trim: true, unique: true },
    description: { type: String, default: '' },
    leaderId: { type: Schema.Types.ObjectId, ref: 'User', default: null },
    coLeaderIds: [{ type: Schema.Types.ObjectId, ref: 'User' }],
    memberIds: [{ type: Schema.Types.ObjectId, ref: 'User' }],
    isActive: { type: Boolean, default: true },
  },
  { timestamps: true }
);

teamSchema.index({ isActive: 1 });

export const Team = mongoose.model<ITeam>('Team', teamSchema);
