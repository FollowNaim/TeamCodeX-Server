import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';
import dotenv from 'dotenv';
import { User } from './models/User';
import { Client } from './models/Client';
import { Project } from './models/Project';

dotenv.config();

const seed = async () => {
  try {
    await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/teamdash');
    console.log('Connected to MongoDB');

    // Clear existing
    await User.deleteMany({});
    await Client.deleteMany({});
    await Project.deleteMany({});

    // Create Team Lead
    const teamLead = await User.create({
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
    const member = await User.create({
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
  } catch (error) {
    console.error('Seeding failed', error);
    process.exit(1);
  }
};

seed();
