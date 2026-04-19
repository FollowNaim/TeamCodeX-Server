"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.Project = void 0;
const mongoose_1 = __importStar(require("mongoose"));
const subtaskSchema = new mongoose_1.Schema({
    title: { type: String, required: true },
    assignedTo: { type: mongoose_1.Schema.Types.ObjectId, ref: 'User' },
    status: { type: String, enum: ['todo', 'in_progress', 'done'], default: 'todo' },
    dueDate: Date,
});
const projectSchema = new mongoose_1.Schema({
    title: { type: String, required: true, trim: true },
    clientId: { type: mongoose_1.Schema.Types.ObjectId, ref: 'Client', required: true },
    orderId: { type: String, unique: true, trim: true },
    price: { type: Number, default: 0 },
    currency: { type: String, enum: ['USD', 'EUR', 'BDT'], default: 'USD' },
    deadline: { type: Date, required: true },
    status: { type: String, enum: ['WIP', 'Delivered', 'Revision', 'Cancelled'], default: 'WIP' },
    assignedUsers: [{ type: mongoose_1.Schema.Types.ObjectId, ref: 'User' }],
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
    timeline: String,
    templateId: { type: mongoose_1.Schema.Types.ObjectId, ref: 'ProjectTemplate' },
    subtasks: [subtaskSchema],
    attachments: [String],
    createdBy: { type: mongoose_1.Schema.Types.ObjectId, ref: 'User', required: true },
    deliveredAt: Date,
}, { timestamps: true });
projectSchema.index({ status: 1, deadline: 1, assignedUsers: 1 });
exports.Project = mongoose_1.default.model('Project', projectSchema);
//# sourceMappingURL=Project.js.map