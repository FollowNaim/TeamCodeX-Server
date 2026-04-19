import mongoose, { Document, Schema, Types } from 'mongoose';

export interface ICredential {
  platform: string;
  username: string;
  encryptedPassword: string;
  iv: string;
}

export interface IClient extends Document {
  name: string;
  email: string;
  website: string;
  loginCredentials: ICredential[];
  remarks: string;
  tags: string[];
  totalRevenue: number;
  createdBy: Types.ObjectId;
}

const credentialSchema = new Schema<ICredential>({
  platform: { type: String, required: true },
  username: { type: String, required: true },
  encryptedPassword: { type: String, required: true },
  iv: { type: String, required: true },
});

const clientSchema = new Schema<IClient>(
  {
    name: { type: String, required: true, trim: true },
    email: { type: String, default: '', lowercase: true, trim: true },
    website: { type: String, default: '' },
    loginCredentials: [credentialSchema],
    remarks: { type: String, default: '' },
    tags: [String],
    totalRevenue: { type: Number, default: 0 },
    createdBy: { type: Schema.Types.ObjectId, ref: 'User', required: true },
  },
  { timestamps: true }
);

export const Client = mongoose.model<IClient>('Client', clientSchema);
