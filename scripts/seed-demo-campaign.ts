/**
 * Seed: cria a campanha de demonstração ao vivo (Stellar Village / pitch).
 * Uso: railway run npx ts-node scripts/seed-demo-campaign.ts
 */

import dotenv from 'dotenv';
dotenv.config();

import { MongoClient, ObjectId } from 'mongodb';

const DEMO_HOST_ID   = '6a068e6ab237b9a480acd739';
const DEMO_CAMPAIGN_ID = new ObjectId('6b0e1cadead105ec638de777');

async function main() {
  const uri = process.env['MONGODB_URI'];
  if (!uri) throw new Error('MONGODB_URI não definido');

  const client = new MongoClient(uri);
  await client.connect();

  const db = client.db();
  const campaigns = db.collection('campaigns');

  // Remove versão anterior se existir
  await campaigns.deleteOne({ _id: DEMO_CAMPAIGN_ID });

  const now = new Date();
  const endDate = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);

  await campaigns.insertOne({
    _id: DEMO_CAMPAIGN_ID,
    host_id: DEMO_HOST_ID,
    title: 'NIDO — Campanha Demo · Escrow Stellar',
    about_project: 'Demonstração do fluxo NIDO de escrow trustless sobre Stellar: cofre multisig 2-de-3 com reserves patrocinadas, depósito em USDC e liberação ao creator via Freighter — sem gas e sem XLM para o usuário.',
    what_we_need: 'Conecte o Freighter, crie o escrow, assine a liberação.',
    content_type: 'post',
    content_pillars: 'web3,stellar,blockchain',
    benefits: 'Pagamento em USDC liquidado on-chain via escrow trustless NIDO',
    requirements: 'Carteira Freighter instalada e conectada à rede da campanha',
    status: 'active',
    payment_chain: 'stellar',
    payment_token: 'USDC',
    target_blockchain: 'stellar',
    total_prize_pool: 50,
    deadline: 30,
    start_date: now,
    end_date: endDate,
    content_format: [{ type: 'post' }],
    submission_format: [{ type: 'link' }],
    content_categories: [{ name: 'web3' }],
    country: [{ code: 'BR', name: 'Brasil' }],
    official_links: [{ label: 'NIDO', url: 'https://nido.global' }],
    support_contact: [{ type: 'email', value: 'support@nido.global' }],
    tiers: [
      { name: '1º lugar', payment_amount: 30, spots: 1 },
      { name: '2º lugar', payment_amount: 20, spots: 1 },
    ],
    isPrivate: false,
    total_submissions: 0,
    created_at: now,
    updated_at: now,
  });

  console.log('✅ Campanha demo criada:', DEMO_CAMPAIGN_ID.toString());
  await client.close();
}

main().catch((e) => { console.error(e); process.exit(1); });
