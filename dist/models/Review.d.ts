import mongoose, { Document, Types } from 'mongoose';
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
export declare const Review: mongoose.Model<IReview, {}, {}, {}, mongoose.Document<unknown, {}, IReview, {}, mongoose.DefaultSchemaOptions> & IReview & Required<{
    _id: Types.ObjectId;
}> & {
    __v: number;
} & {
    id: string;
}, any, IReview>;
//# sourceMappingURL=Review.d.ts.map