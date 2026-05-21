import { Router, Request, Response } from 'express';
import { ObjectId } from 'mongodb';
import connectDB, { getBountiesDB } from '../config/database';

const router = Router();

// One-shot seed — only active when SEED_SECRET env var is set
// Call once: POST /api/seed/demo-campaign  -H "x-seed-secret: VALUE"
router.post('/demo-campaign', async (req: Request, res: Response) => {
  const secret = process.env['SEED_SECRET'];
  if (!secret || req.headers['x-seed-secret'] !== secret) {
    return res.status(403).json({ message: 'Forbidden' });
  }

  try {
    await connectDB();
    const db = await getBountiesDB();
    const campaigns = db.collection('campaigns');

    const DEMO_ID = new ObjectId('6b0e1cadead105ec638de777');
    const DEMO_HOST_ID = '6a068e6ab237b9a480acd739';

    await campaigns.deleteOne({ _id: DEMO_ID });

    const now = new Date();
    const endDate = new Date(now.getTime() + 45 * 24 * 60 * 60 * 1000);

    await campaigns.insertOne({
      _id: DEMO_ID,
      host_id: DEMO_HOST_ID,
      title: 'NIDO Demo — Escrow Stellar (37 Graus)',
      about_project: 'Campanha demo do hackathon 37 Graus para testar o fluxo completo de escrow Stellar: criação multisig 2-de-3, depósito USDC testnet e liberação via Freighter.',
      what_we_need: 'Conecte o Freighter, crie o escrow, assine a liberação e acompanhe no Stellar Expert.',
      content_type: 'post',
      content_pillars: 'web3,stellar,blockchain',
      benefits: 'USDC testnet via Stellar Escrow',
      requirements: 'Freighter wallet instalado e configurado para testnet',
      status: 'active',
      payment_chain: 'stellar',
      payment_token: 'USDC',
      target_blockchain: 'stellar',
      total_prize_pool: 50,
      deadline: 45,
      start_date: now,
      end_date: endDate,
      content_format: [{ type: 'post' }],
      submission_format: [{ type: 'link' }],
      content_categories: [{ name: 'web3' }],
      country: [{ code: 'BR', name: 'Brasil' }],
      official_links: [{ label: 'NIDO', url: 'https://bounties.work' }],
      support_contact: [{ type: 'email', value: 'demo@nido.demo' }],
      tiers: [
        { name: '1º lugar', payment_amount: 30, spots: 1 },
        { name: '2º lugar', payment_amount: 20, spots: 1 },
      ],
      isPrivate: false,
      total_submissions: 0,
      created_at: now,
      updated_at: now,
    });

    return res.json({ success: true, campaignId: DEMO_ID.toString() });
  } catch (e: any) {
    return res.status(500).json({ message: e.message });
  }
});

export default router;
