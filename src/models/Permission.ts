import mongoose, { Document, Schema, Types } from 'mongoose';

export interface IPermission extends Document {
  userId: Types.ObjectId;
  teamId?: Types.ObjectId;
  overrides: {
    canViewAnalytics: boolean;
    canViewAllMembers: boolean;
    canManageProjects: boolean;
    canViewCrossTeam: boolean;
    canManageMembers: boolean;
    canAccessBazuka: boolean;
  };
}

const permissionSchema = new Schema<IPermission>(
  {
    userId: { type: Schema.Types.ObjectId, ref: 'User', required: true, unique: true },
    teamId: { type: Schema.Types.ObjectId, ref: 'Team', default: null },
    overrides: {
      canViewAnalytics: { type: Boolean, default: false },
      canViewAllMembers: { type: Boolean, default: false },
      canManageProjects: { type: Boolean, default: false },
      canViewCrossTeam: { type: Boolean, default: false },
      canManageMembers: { type: Boolean, default: false },
      canAccessBazuka: { type: Boolean, default: false },
    },
  },
  { timestamps: true }
);

permissionSchema.index({ userId: 1 });

export const Permission = mongoose.model<IPermission>('Permission', permissionSchema);
