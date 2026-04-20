/**
 * One-time migration script.
 * Run with: npx ts-node src/scripts/setupOpsManager.ts
 *
 * What it does:
 * 1. Promotes a user (by email) to ops-manager
 * 2. Creates a "Default Team" if none exists
 * 3. Assigns all existing users (with no teamId) to that default team
 */

import mongoose from 'mongoose';
import dotenv from 'dotenv';
dotenv.config();

import { User } from '../models/User';
import { Team } from '../models/Team';

const OPS_MANAGER_EMAIL = process.env.OPS_MANAGER_EMAIL || '';

async function run() {
  if (!process.env.MONGO_URI) { console.error('❌ MONGO_URI not set'); process.exit(1); }
  if (!OPS_MANAGER_EMAIL) { console.error('❌ Set OPS_MANAGER_EMAIL env var'); process.exit(1); }

  await mongoose.connect(process.env.MONGO_URI);
  console.log('✅ Connected to MongoDB');

  // 1. Promote user to ops-manager
  const opsUser = await User.findOneAndUpdate(
    { email: OPS_MANAGER_EMAIL },
    { role: 'ops-manager', isApproved: true, isActive: true },
    { new: true }
  );
  if (!opsUser) { console.error(`❌ User not found: ${OPS_MANAGER_EMAIL}`); process.exit(1); }
  console.log(`✅ Promoted ${opsUser.name} (${opsUser.email}) to ops-manager`);

  // 2. Create default team if none exists
  let defaultTeam = await Team.findOne({ name: 'Default Team' });
  if (!defaultTeam) {
    defaultTeam = await Team.create({ name: 'Default Team', description: 'Auto-created default team', isActive: true });
    console.log('✅ Created "Default Team"');
  } else {
    console.log('ℹ️  "Default Team" already exists');
  }

  // 3. Find the first team-lead to assign as leader
  const existingLead = await User.findOne({ role: 'team-lead', teamId: null });
  if (existingLead && !defaultTeam.leaderId) {
    defaultTeam.leaderId = existingLead._id as any;
    await User.findByIdAndUpdate(existingLead._id, { teamId: defaultTeam._id });
    console.log(`✅ Assigned ${existingLead.name} as Default Team leader`);
  }

  // 4. Assign all users without a teamId (excluding ops-manager) to the default team
  const unassigned = await User.find({ teamId: null, role: { $ne: 'ops-manager' } });
  const unassignedIds = unassigned.map(u => u._id);

  if (unassignedIds.length) {
    await User.updateMany({ _id: { $in: unassignedIds } }, { teamId: defaultTeam._id });
    const coLeaders = unassigned.filter(u => u.role === 'co-lead').map(u => u._id);
    const members = unassigned.filter(u => u.role === 'member').map(u => u._id);
    defaultTeam.coLeaderIds = [...(defaultTeam.coLeaderIds || []), ...(coLeaders as any)];
    defaultTeam.memberIds = [...(defaultTeam.memberIds || []), ...(members as any)];
    await defaultTeam.save();
    console.log(`✅ Assigned ${unassignedIds.length} users to Default Team`);
  } else {
    console.log('ℹ️  All users already have a team');
  }

  console.log('\n🎉 Migration complete!');
  process.exit(0);
}

run().catch(err => { console.error(err); process.exit(1); });
