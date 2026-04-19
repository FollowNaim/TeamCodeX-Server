import mongoose, { Document, Types } from 'mongoose';
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
export declare const Client: mongoose.Model<IClient, {}, {}, {}, mongoose.Document<unknown, {}, IClient, {}, mongoose.DefaultSchemaOptions> & IClient & Required<{
    _id: Types.ObjectId;
}> & {
    __v: number;
} & {
    id: string;
}, any, IClient>;
//# sourceMappingURL=Client.d.ts.map