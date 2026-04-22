import dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.resolve(process.cwd(), '.env') });

function requireEnv(name: string): string {
  const v = process.env[name];
  if (!v) {
    console.error(`${name} environment variable is required`);
    process.exit(1);
  }
  return v;
}

const ADMIN_EMAIL = requireEnv('ADMIN_EMAIL');
const ADMIN_PASSWORD = requireEnv('ADMIN_PASSWORD');

async function main() {
  const { getBountiesDB } = await import('../src/config/database');
  const { UserModel } = await import('../src/models/User');

  await getBountiesDB();

  const existing = await UserModel.findByEmail(ADMIN_EMAIL);
  if (existing) {
    console.log('Admin user already exists:', ADMIN_EMAIL);
    process.exit(0);
  }

  const password_hash = await UserModel.hashPassword(ADMIN_PASSWORD);
  const localPart = ADMIN_EMAIL.split('@')[0];
  const username = (localPart?.toLowerCase().replace(/[^a-z0-9]/g, '') || 'admin').slice(0, 20);

  await UserModel.create({
    username: `admin_${username}`,
    email: ADMIN_EMAIL,
    user_type: 'ADMIN',
    password_hash,
    email_verified: true,
    isActive: true,
    campaigns_created: 0
  });

  console.log('Admin user created successfully:', ADMIN_EMAIL);
  console.log('Password: (use the one set in ADMIN_PASSWORD or the default in this script)');
  process.exit(0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
