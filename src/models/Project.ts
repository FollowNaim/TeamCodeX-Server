import mongoose, { Document, Schema, Types } from 'mongoose';

export interface ISubtask {
  _id: Types.ObjectId;
  title: string;
  assignedTo?: Types.ObjectId;
  status: 'todo' | 'in_progress' | 'done';
  dueDate?: Date;
}

export interface IProject extends Document {
  title: string;
  clientId: Types.ObjectId;
  orderId: string;
  price: number;
  currency: 'USD' | 'EUR' | 'BDT';
  deadline: Date;
  status: 'WIP' | 'Delivered' | 'Revision' | 'Cancelled' | 'Hold' | 'NRA';
  assignedUsers: Types.ObjectId[];
  tags: string[];
  priority: 'low' | 'medium' | 'high' | 'urgent';
  notes: string;
  isBazuka: boolean;
  salesEmployee?: string;
  incomingDate: Date;
  profileName: string;
  deliveryAmount: number;
  clientUserId?: string;
  orderLink?: string;
  sheetLink?: string;
  credentials?: string;
  timeline?: string;
  templateId?: Types.ObjectId;
  subtasks: ISubtask[];
  attachments: string[];
  createdBy: Types.ObjectId;
  deliveredAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

const subtaskSchema = new Schema<ISubtask>({
  title: { type: String, required: true },
  assignedTo: { type: Schema.Types.ObjectId, ref: 'User' },
  status: { type: String, enum: ['todo', 'in_progress', 'done'], default: 'todo' },
  dueDate: Date,
});

const projectSchema = new Schema<IProject>(
  {
    title: { type: String, required: true, trim: true },
    clientId: { type: Schema.Types.ObjectId, ref: 'Client', required: true },
    orderId: { type: String, unique: true, trim: true },
    price: { type: Number, default: 0 },
    currency: { type: String, enum: ['USD', 'EUR', 'BDT'], default: 'USD' },
    deadline: { type: Date, required: true },
    status: { type: String, enum: ['WIP', 'Delivered', 'Revision', 'Cancelled', 'Hold', 'NRA'], default: 'WIP' },
    assignedUsers: [{ type: Schema.Types.ObjectId, ref: 'User' }],
    tags: [String],
    priority: { type: String, enum: ['low', 'medium', 'high', 'urgent'], default: 'medium' },
    notes: { type: String, default: '' },
    isBazuka: { type: Boolean, default: false },
    salesEmployee: String,
    incomingDate: { type: Date, default: Date.now },
    profileName: { type: String, default: '' },
    deliveryAmount: { type: Number, default: 0 },
    clientUserId: String,
    orderLink: String,
    sheetLink: String,
    credentials: { type: String, default: '' },
    timeline: String,
    templateId: { type: Schema.Types.ObjectId, ref: 'ProjectTemplate' },
    subtasks: [subtaskSchema],
    attachments: [String],
    createdBy: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    deliveredAt: Date,
  },
  { timestamps: true }
);

projectSchema.index({ status: 1, deadline: 1, assignedUsers: 1 });

export const Project = mongoose.model<IProject>('Project', projectSchema);
