import dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.resolve(process.cwd(), '.env') });

const EMAIL = process.env['HOST_EMAIL'] || 'host-enterprise@test.com';
const PASSWORD = process.env['HOST_PASSWORD'] || 'Host@123456';

async function main() {
  const { getBountiesDB } = await import('../src/config/database');
  const { UserModel } = await import('../src/models/User');
  const { PlanModel } = await import('../src/models/Plan');
  const { generateToken } = await import('../src/config/jwt');

  await getBountiesDB();

  await PlanModel.ensureDefaults();
  const enterprise = await PlanModel.findByName('ENTERPRISE');
  if (!enterprise || !enterprise._id) {
    console.error('ENTERPRISE plan not found');
    process.exit(1);
  }

  let user = await UserModel.findByEmail(EMAIL);

  if (!user) {
    const password_hash = await UserModel.hashPassword(PASSWORD);
    user = await UserModel.create({
      username: 'host_enterprise_test',
      email: EMAIL,
      user_type: 'HOST',
      password_hash,
      email_verified: true,
      isActive: true,
      active_account_host: true,
      plan_id: enterprise._id.toString(),
      campaigns_created: 0,
    });
    console.log('Host ENTERPRISE created:', EMAIL);
    console.log('Password:', PASSWORD);
  } else {
    await UserModel.updateById(user._id!.toString(), {
      plan_id: enterprise._id.toString(),
      user_type: 'HOST',
      active_account_host: true,
    });
    console.log('Host updated to ENTERPRISE:', EMAIL);
  }

  const token = generateToken({
    userId: user._id!.toString(),
    email: EMAIL,
    role: 'HOST',
    planId: enterprise._id.toString(),
    planName: 'ENTERPRISE',
    status: 'active',
    registerCompleted: true,
  });

  console.log('\n--- Token JWT (valid 7d) ---');
  console.log(token);
  console.log('---------------------------\n');

  process.exit(0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
