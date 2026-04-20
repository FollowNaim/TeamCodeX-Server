import mongoose, { Document, Schema, Types } from 'mongoose';
import bcrypt from 'bcryptjs';

export interface IUser extends Document {
  name: string;
  email: string;
  passwordHash: string;
  role: 'ops-manager' | 'team-lead' | 'co-lead' | 'member';
  teamId?: Types.ObjectId;
  avatar: string;
  skills: string[];
  badges: string[];
  isActive: boolean;
  isApproved: boolean;
  comparePassword(password: string): Promise<boolean>;
}

const userSchema = new Schema<IUser>(
  {
    name: { type: String, required: true, trim: true },
    email: { type: String, required: true, unique: true, lowercase: true, trim: true },
    passwordHash: { type: String, required: true },
    role: { type: String, enum: ['ops-manager', 'team-lead', 'co-lead', 'member'], default: 'member' },
    teamId: { type: Schema.Types.ObjectId, ref: 'Team', default: null },
    avatar: { type: String, default: '' },
    skills: [{ type: String }],
    badges: [{ type: String }],
    isActive: { type: Boolean, default: true },
    isApproved: { type: Boolean, default: false },
  },
  { timestamps: true }
);

userSchema.pre('save', async function () {
  if (!this.isModified('passwordHash')) return;
  this.passwordHash = await bcrypt.hash(this.passwordHash, 12);
});

userSchema.methods.comparePassword = async function (password: string): Promise<boolean> {
  return bcrypt.compare(password, this.passwordHash);
};

export const User = mongoose.model<IUser>('User', userSchema);
