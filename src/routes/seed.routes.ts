import { Router, Request, Response } from 'express';
import { ObjectId } from 'mongodb';
import connectDB, { getBountiesDB } from '../config/database';

const router = Router();

const SLOTS = [
  { campaignId: '6b0e1cadead105ec638de777', talentId: '000000000000000000000002', talentN: 1 },
  { campaignId: '6b0e1cadead105ec638de778', talentId: '000000000000000000000003', talentN: 2 },
  { campaignId: '6b0e1cadead105ec638de779', talentId: '000000000000000000000004', talentN: 3 },
  { campaignId: '6b0e1cadead105ec638de77a', talentId: '000000000000000000000005', talentN: 4 },
];

const DEMO_HOST_ID = new ObjectId('6a068e6ab237b9a480acd739');
const DEMO_ADMIN_ID = new ObjectId('000000000000000000000001');

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
    const users = db.collection('users');
    const escrows = db.collection('stellar_escrows');

    const now = new Date();
    const endDate = new Date(now.getTime() + 45 * 24 * 60 * 60 * 1000);

    // Upsert host and admin
    await users.updateOne(
      { _id: DEMO_HOST_ID },
      {
        $setOnInsert: {
          _id: DEMO_HOST_ID,
          username: 'nido-demo',
          user_type: 'HOST',
          email: 'demo-host@nido.demo',
          email_verified: true,
          isActive: true,
          status: 'active',
          active_account_host: true,
          plan_id: 'BASIC',
          campaigns_created: SLOTS.length,
          registerCompleted: true,
          created_at: now,
          updated_at: now,
        },
      },
      { upsert: true }
    );

    await users.updateOne(
      { _id: DEMO_ADMIN_ID },
      {
        $setOnInsert: {
          _id: DEMO_ADMIN_ID,
          username: 'admin',
          user_type: 'ADMIN',
          email: 'admin@nido.demo',
          email_verified: true,
          isActive: true,
          status: 'active',
          campaigns_created: 0,
          registerCompleted: true,
          created_at: now,
          updated_at: now,
        },
      },
      { upsert: true }
    );

    const created: string[] = [];

    for (const slot of SLOTS) {
      const campaignOid = new ObjectId(slot.campaignId);
      const talentOid = new ObjectId(slot.talentId);

      // Upsert talent user (reset wallet so each tester registers fresh)
      await users.updateOne(
        { _id: talentOid },
        {
          $set: {
            _id: talentOid,
            username: `demo-talent${slot.talentN}`,
            user_type: 'CREATOR',
            email: `demo-talent${slot.talentN}@nido.demo`,
            email_verified: true,
            isActive: true,
            status: 'active',
            campaigns_created: 0,
            first_login: false,
            wallet_stellar: undefined,
            updated_at: now,
          },
          $setOnInsert: { created_at: now },
        },
        { upsert: true }
      );

      // Delete any existing escrow for this campaign slot
      await escrows.deleteOne({ job_id: slot.campaignId });

      // Recreate campaign
      await campaigns.deleteOne({ _id: campaignOid });
      await campaigns.insertOne({
        _id: campaignOid,
        host_id: DEMO_HOST_ID.toString(),
        title: `NIDO Demo — Escrow Stellar (Slot ${slot.talentN})`,
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

      created.push(slot.campaignId);
    }

    return res.json({ success: true, slots: created });
  } catch (e: any) {
    return res.status(500).json({ message: e.message });
  }
});

export default router;
