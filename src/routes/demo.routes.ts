import { Router, Request, Response } from 'express';
import { generateToken } from '../config/jwt';

/**
 * Demo-login for the 37 Graus / NearX sprint rehearsal.
 *
 * SECURITY: tokens are minted server-side here, signed with the live JWT_SECRET,
 * so nothing sensitive ships in the client bundle (no hardcoded tokens, no admin
 * backdoor). The whole router is only mounted when DEMO_LOGIN_ENABLED === 'true',
 * so it is inert on any environment that doesn't explicitly opt in.
 *
 * The arbiter/admin role is intentionally NOT issuable here — arbitration moves
 * real USDC on mainnet and must go through the regular authenticated admin login.
 */

const HOST_ID = '6a068e6ab237b9a480acd739';

// Demo tokens are deliberately short-lived: a rehearsal session lasts hours, not
// the 7d default. Keeps the blast radius small if a token leaks during the demo.
const DEMO_TOKEN_TTL = process.env['DEMO_TOKEN_TTL'] || '12h';

// Slot → seeded campaign + talent user. Kept in sync with seed.routes.ts SLOTS.
const SLOTS = [
  { campaignId: '6b0e1cadead105ec638de777', talentId: '000000000000000000000002' },
  { campaignId: '6b0e1cadead105ec638de778', talentId: '000000000000000000000003' },
  { campaignId: '6b0e1cadead105ec638de779', talentId: '000000000000000000000004' },
  { campaignId: '6b0e1cadead105ec638de77a', talentId: '000000000000000000000005' },
  { campaignId: '6b0e1cadead105ec638de77b', talentId: '000000000000000000000006' },
];

interface DemoSession {
  userId: string;
  email: string;
  role: 'HOST' | 'CREATOR';
  username: string;
  redirect: string;
  user: Record<string, unknown>;
}

function buildSessions(): Record<string, DemoSession> {
  const sessions: Record<string, DemoSession> = {
    host: {
      userId: HOST_ID,
      email: 'demo-host@nido.demo',
      role: 'HOST',
      username: 'nido-demo',
      redirect: `/host/campaign/${SLOTS[0]!.campaignId}`,
      user: {
        id: HOST_ID,
        username: 'nido-demo',
        email: 'demo-host@nido.demo',
        role: 'host',
        registerCompleted: true,
        accountStatus: 'active',
        active_account_host: true,
      },
    },
  };

  SLOTS.forEach((slot, i) => {
    const n = i + 1;
    sessions[`talent${n}`] = {
      userId: slot.talentId,
      email: `demo-talent${n}@nido.demo`,
      role: 'CREATOR',
      username: `demo-talent${n}`,
      redirect: `/creator/campaign/${slot.campaignId}`,
      user: {
        id: slot.talentId,
        username: `demo-talent${n}`,
        email: `demo-talent${n}@nido.demo`,
        role: 'creator',
        accountStatus: 'active',
        first_login: false,
      },
    };
  });

  return sessions;
}

const router = Router();
const SESSIONS = buildSessions();

// POST /api/demo/login  { role: 'host' | 'talent1'..'talent5' }
router.post('/login', (req: Request, res: Response) => {
  const role = String(req.body?.role ?? '');
  const session = SESSIONS[role];
  if (!session) {
    return res.status(400).json({ success: false, message: `Unknown demo role: ${role}` });
  }

  const token = generateToken({
    userId: session.userId,
    email: session.email,
    role: session.role,
    status: 'active',
    ...(session.role === 'HOST' ? { registerCompleted: true } : {}),
  }, DEMO_TOKEN_TTL);

  return res.json({
    success: true,
    data: {
      token,
      user: session.user,
      redirect: session.redirect,
    },
  });
});

// GET /api/demo/roles — list selectable demo roles (no secrets)
router.get('/roles', (_req: Request, res: Response) => {
  return res.json({
    success: true,
    data: Object.keys(SESSIONS),
  });
});

export default router;
