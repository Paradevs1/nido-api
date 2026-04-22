import dotenv from 'dotenv';
dotenv.config();

const REQUIRED_ENV_VARS = [
  'MONGODB_URI',
  'JWT_SECRET',
  'CRON_SECRET',
  'EVM_PRIVATE_KEY',
  'SOLANA_PRIVATE_KEY',
  'SUI_PRIVATE_KEY',
];

const missingVars = REQUIRED_ENV_VARS.filter(key => !process.env[key]);
if (missingVars.length > 0) {
  console.error(`Missing required environment variables: ${missingVars.join(', ')}`);
  process.exit(1);
}
