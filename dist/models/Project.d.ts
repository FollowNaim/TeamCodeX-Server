import mongoose, { Document, Types } from 'mongoose';
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
    status: 'WIP' | 'Delivered' | 'Revision' | 'Cancelled';
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
    timeline?: string;
    templateId?: Types.ObjectId;
    subtasks: ISubtask[];
    attachments: string[];
    createdBy: Types.ObjectId;
    deliveredAt?: Date;
    createdAt: Date;
    updatedAt: Date;
}
export declare const Project: mongoose.Model<IProject, {}, {}, {}, mongoose.Document<unknown, {}, IProject, {}, mongoose.DefaultSchemaOptions> & IProject & Required<{
    _id: Types.ObjectId;
}> & {
    __v: number;
} & {
    id: string;
}, any, IProject>;
//# sourceMappingURL=Project.d.ts.map