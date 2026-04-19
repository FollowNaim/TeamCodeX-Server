"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const mongoose_1 = __importDefault(require("mongoose"));
const dotenv_1 = __importDefault(require("dotenv"));
const User_1 = require("./models/User");
const Client_1 = require("./models/Client");
const Project_1 = require("./models/Project");
dotenv_1.default.config();
const seed = async () => {
    try {
        await mongoose_1.default.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/teamdash');
        console.log('Connected to MongoDB');
        // Clear existing
        await User_1.User.deleteMany({});
        await Client_1.Client.deleteMany({});
        await Project_1.Project.deleteMany({});
        // Create Team Lead
        const teamLead = await User_1.User.create({
            name: 'Team Lead',
            email: 'lead@teamdash.com',
            passwordHash: 'password123', // will be hashed by pre-save
            role: 'team-lead',
            skills: ['Management', 'Full Stack'],
            badges: ['top_performer'],
            isActive: true,
            isApproved: true,
        });
        // Create Member
        const member = await User_1.User.create({
            name: 'Team Member',
            email: 'member@teamdash.com',
            passwordHash: 'password123',
            role: 'member',
            skills: ['Design', 'Frontend'],
            badges: [],
            isActive: true,
            isApproved: true,
        });
        console.log('Seeded Users: lead@teamdash.com / password123, member@teamdash.com / password123');
        process.exit(0);
    }
    catch (error) {
        console.error('Seeding failed', error);
        process.exit(1);
    }
};
seed();
//# sourceMappingURL=seed.js.map