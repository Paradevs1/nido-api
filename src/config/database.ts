import dotenv from 'dotenv';
import { MongoClient, ServerApiVersion } from 'mongodb';
dotenv.config();
const uri = process.env['MONGODB_URI'];

if (!uri) {
  throw new Error('MONGODB_URI environment variable is not defined');
}

const client = new MongoClient(uri, {
  serverApi: {
    version: ServerApiVersion.v1,
    strict: true,
    deprecationErrors: true,
  },
  connectTimeoutMS: 10000,
  serverSelectionTimeoutMS: 10000,
  socketTimeoutMS: 45000,
  maxPoolSize: parseInt(process.env['MONGODB_POOL_MAX'] || '50', 10),
  minPoolSize: parseInt(process.env['MONGODB_POOL_MIN'] || '2', 10),
  maxIdleTimeMS: 30000,
  retryWrites: true,
  retryReads: true,
});

let isConnected = false;

const mongo = async () => {
  if (!isConnected) {
    try {
      await client.connect();
      await client.db("admin").command({ ping: 1 });
      isConnected = true;
      console.log("✅ Connected to MongoDB");
    } catch (error: any) {
      console.error("❌ Failed to connect to MongoDB:", error.message);
      isConnected = false;
      // Não lança o erro - permite que a aplicação continue
      // A conexão será tentada novamente quando necessário via ensureConnection
    }
  }
  return client;
};

const ensureConnection = async () => {
  try {
    if (!isConnected) {
      await mongo();
    } else {
      // Verifica se a conexão ainda está ativa
      try {
        await client.db("admin").command({ ping: 1 });
      } catch (pingError) {
        // Se o ping falhar, reconecta
        console.log("MongoDB connection lost, reconnecting...");
        isConnected = false;
        await mongo();
      }
    }
    return client;
  } catch (error: any) {
    console.error("Error ensuring MongoDB connection:", error.message);
    isConnected = false;
    // Tenta reconectar uma vez
    try {
      await mongo();
      return client;
    } catch (retryError: any) {
      throw new Error(`Failed to connect to MongoDB after retry: ${retryError.message}`);
    }
  }
};

process.on('SIGINT', async () => {
  if (isConnected) {
    await client.close();
    isConnected = false;
  }
  process.exit(0);
});

const getBountiesDB = async () => {
  const client = await ensureConnection();
  return client.db("bounties");
};

let indexesCreated = false;

const ensureIndexes = async () => {
  if (indexesCreated) return;
  try {
    const db = await getBountiesDB();

    await Promise.all([
      db.collection('users').createIndex(
        { email: 1 },
        { unique: true, partialFilterExpression: { email: { $type: 'string', $gt: '' } } }
      ),
      db.collection('users').createIndex({ twitter_id: 1 }, { sparse: true }),
      db.collection('users').createIndex({ tiktok_id: 1 }, { sparse: true }),
      db.collection('users').createIndex({ google_id: 1 }, { sparse: true }),
      db.collection('users').createIndex({ username: 1 }),
      db.collection('users').createIndex({ user_type: 1 }),
      db.collection('users').createIndex({ wallet_evm: 1, wallet_sol: 1, wallet_sui: 1, wallet_stellar: 1 }, { sparse: true }),

      // Campaigns indexes
      db.collection('campaigns').createIndex({ host_id: 1 }),
      db.collection('campaigns').createIndex({ status: 1 }),
      db.collection('campaigns').createIndex({ status: 1, end_date: 1 }),

      // CampaignParticipants indexes
      db.collection('campaign_participants').createIndex({ campaign_id: 1 }),
      db.collection('campaign_participants').createIndex({ campaign_id: 1, userId: 1 }),

      // Payments indexes
      db.collection('payments').createIndex({ campaign_id: 1 }),
      db.collection('payments').createIndex({ userId: 1 }),

      // PaymentHost indexes
      db.collection('payment_hosts').createIndex({ campaign_id: 1 }),
      db.collection('payment_hosts').createIndex({ host_id: 1 }),

      // ShortURL indexes
      db.collection('encurtador_urls').createIndex({ campaign_id: 1 }),
      db.collection('encurtador_urls').createIndex({ userId: 1 }),

      // EmailVerificationCode indexes
      db.collection('email_verification_codes').createIndex({ user_id: 1 }),
      db.collection('email_verification_codes').createIndex({ email: 1 }),
      db.collection('email_verification_codes').createIndex({ expires_at: 1 }, { expireAfterSeconds: 0 }),

      // Community indexes
      db.collection('communities').createIndex({ host_id: 1 }),

      // CommunityMember indexes
      db.collection('community_members').createIndex({ community_id: 1 }),
      db.collection('community_members').createIndex({ creator_id: 1 }),
      db.collection('community_members').createIndex({ community_id: 1, creator_id: 1 }, { unique: true }),
      db.collection('community_members').createIndex({ community_id: 1, status: 1 }),

      // CommunityAnnouncement indexes
      db.collection('community_announcements').createIndex({ community_id: 1 }),

      // CommunityMessage indexes
      db.collection('community_messages').createIndex({ community_id: 1 }),
      db.collection('community_messages').createIndex({ community_id: 1, created_at: -1 }),

      // Campaign community index
      db.collection('campaigns').createIndex({ community_id: 1 }, { sparse: true }),

      // Notification indexes
      db.collection('notifications').createIndex({ recipient_id: 1, created_at: -1 }),
      db.collection('notifications').createIndex({ recipient_id: 1, read: 1 }),
    ]);

    indexesCreated = true;
    console.log("Indexes ensured successfully");
  } catch (error: any) {
    console.error("Error creating indexes:", error.message);
  }
};

export { ensureConnection, getBountiesDB, ensureIndexes };
export default mongo;