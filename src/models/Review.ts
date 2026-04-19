import mongoose, { Document, Schema, Types } from 'mongoose';

export interface IReview extends Document {
  clientId: Types.ObjectId;
  projectId: Types.ObjectId;
  submittedBy: Types.ObjectId;
  rating: 1 | 2 | 3 | 4 | 5;
  reviewText: string;
  status: 'pending' | 'approved' | 'rejected';
  approvedBy?: Types.ObjectId;
  approvedAt?: Date;
}

const reviewSchema = new Schema<IReview>(
  {
    clientId: { type: Schema.Types.ObjectId, ref: 'Client', required: true },
    projectId: { type: Schema.Types.ObjectId, ref: 'Project', required: true },
    submittedBy: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    rating: { type: Number, min: 1, max: 5, required: true },
    reviewText: { type: String, default: '' },
    status: { type: String, enum: ['pending', 'approved', 'rejected'], default: 'pending' },
    approvedBy: { type: Schema.Types.ObjectId, ref: 'User' },
    approvedAt: Date,
  },
  { timestamps: true }
);

export const Review = mongoose.model<IReview>('Review', reviewSchema);
