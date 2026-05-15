/**
 * seed-host-dev.ts
 * Cria o host demo (vinculado ao JWT fixo de /demo-login) + 2 campanhas Stellar.
 * Uso: npx ts-node -r tsconfig-paths/register scripts/seed-host-dev.ts
 */

import 'dotenv/config';
import { MongoClient, ObjectId } from 'mongodb';

const MONGO_URI = process.env['MONGODB_URI'] || 'mongodb://localhost:27017/bounties';

// ID fixo que corresponde ao JWT hardcoded em /demo-login
const DEMO_USER_ID = new ObjectId('6a068e6ab237b9a480acd739');
const DEMO_EMAIL    = 'demo-host@nido.demo';

async function main() {
  const client = new MongoClient(MONGO_URI);
  await client.connect();
  const db = client.db();

  // ── 1. Plano BASIC ───────────────────────────────────────────────────────────
  let plan = await db.collection('plans').findOne({ name: 'BASIC' });
  if (!plan) {
    const res = await db.collection('plans').insertOne({
      name: 'BASIC',
      description: 'Plano básico',
      price: 0,
      max_campaigns: 10,
      is_active: true,
      created_at: new Date(),
      updated_at: new Date(),
    });
    plan = { _id: res.insertedId, name: 'BASIC' };
    console.log('✅  Plano BASIC criado');
  } else {
    console.log('ℹ️   Plano BASIC já existe');
  }

  // ── 2. Usuário demo (upsert — preserva se já existir) ────────────────────────
  await db.collection('users').updateOne(
    { _id: DEMO_USER_ID },
    {
      $set: {
        _id: DEMO_USER_ID,
        username: 'nido-demo',
        email: DEMO_EMAIL,
        user_type: 'HOST',
        email_verified: true,
        isActive: true,
        status: 'active',
        active_account_host: true,
        registerCompleted: true,
        plan_id: plan._id.toString(),
        duration_plan: null,
        campaigns_created: 2,
        updated_at: new Date(),
      },
      $setOnInsert: { created_at: new Date() },
    },
    { upsert: true }
  );
  console.log(`✅  Usuário demo — _id: ${DEMO_USER_ID}`);

  // ── 3. Campanhas demo Stellar ─────────────────────────────────────────────────
  const hostId = DEMO_USER_ID.toString();
  const now    = new Date();
  const end    = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000); // +30 dias

  const campaigns = [
    {
      title: 'NIDO x Stellar — Bounty de Conteúdo Web3',
      about_project:
        'NIDO é uma plataforma de bounties non-custodial construída sobre Stellar. ' +
        'Nesta campanha demonstramos o fluxo completo de escrow: bloqueio, multisig e liberação de USDC on-chain.',
      what_we_need:
        'Crie um post no LinkedIn explicando como o NIDO usa Stellar Escrow para garantir pagamentos sem custódia.',
      payment_chain: 'stellar',
      payment_token: 'USDC',
      total_prize_pool: 10,
      total_budget: 10,
    },
    {
      title: 'NIDO Demo — Stellar Escrow Hackathon 37 Graus',
      about_project:
        'Campanha de demonstração para avaliadores do hackathon 37 Graus testarem o fluxo completo de escrow Stellar: ' +
        'criação de conta multisig 2-de-3, depósito de USDC testnet via treasury com sponsored reserves, ' +
        'assinatura via Freighter e liberação com FeeBump.',
      what_we_need:
        'Conecte o Freighter, crie o escrow, assine a liberação e verifique a transação no Stellar Expert.',
      payment_chain: 'stellar',
      payment_token: 'USDC',
      total_prize_pool: 10,
      total_budget: 10,
    },
  ];

  for (const c of campaigns) {
    const exists = await db.collection('campaigns').findOne({
      host_id: hostId,
      title: c.title,
    });

    if (exists) {
      console.log(`ℹ️   Campanha já existe: "${c.title}"`);
      continue;
    }

    const campaignId = new ObjectId();
    await db.collection('campaigns').insertOne({
      _id: campaignId,
      host_id: hostId,
      title: c.title,
      about_project: c.about_project,
      what_we_need: c.what_we_need,
      content_type: 'post',
      content_pillars: 'web3,blockchain,stellar',
      benefits: 'USDC testnet via Stellar Escrow',
      requirements: 'Freighter wallet instalado',
      submission_format: [{ type: 'link' }],
      content_format: [{ type: 'post' }],
      content_categories: [{ name: 'web3' }],
      target_blockchain: 'stellar',
      official_links: [{ label: 'NIDO', url: 'https://bounties.work' }],
      support_contact: [{ type: 'email', value: 'demo@nido.demo' }],
      country: [{ code: 'BR', name: 'Brasil' }],
      start_date: now,
      end_date: end,
      payment_chain: c.payment_chain,
      payment_token: c.payment_token,
      max_participants: 50,
      winner_count: 1,
      reward_tiers: [{ position: 1, amount: c.total_prize_pool }],
      total_prize_pool: c.total_prize_pool,
      total_budget: c.total_budget,
      links_officials: [],
      status: 'active',
      payment_received: true,
      rewards_distributed: false,
      is_job_twitter_executed: false,
      is_job_tiktok_executed: false,
      is_job_instagram_executed: false,
      is_job_youtube_executed: false,
      isPrivate: false,
      created_at: now,
      updated_at: now,
    });

    console.log(`✅  Campanha criada: "${c.title}" — _id: ${campaignId}`);
  }

  await client.close();

  console.log('\n──────────────────────────────────────────────────────────────');
  console.log('  Demo pronto!');
  console.log(`  Acesse: <FRONTEND_URL>/demo-login`);
  console.log('  Clique "Entrar como Host" → abre a lista de campanhas');
  console.log('  Abra uma campanha → conecte Freighter → clique "Depositar"');
  console.log('──────────────────────────────────────────────────────────────\n');
}

main().catch((e) => { console.error(e); process.exit(1); });
