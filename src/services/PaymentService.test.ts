/**
 * Testes para verificar que falhas individuais de pagamento
 * NÃO abortam o loop dos demais winners (SOL, SUI, EVM).
 * Todos os pagamentos são mockados — nenhuma transação real é executada.
 */

// ── Mocks (devem vir antes dos imports) ──────────────────────────────

const mockPayments: any[] = [];

jest.mock('../models/Payment', () => ({
  PaymentModel: {
    findByCampaignId: jest.fn(() => Promise.resolve(mockPayments)),
    create: jest.fn((data: any) => Promise.resolve({ _id: 'mock-payment-id', ...data })),
  },
}));

jest.mock('../models/CampaignParticipants', () => ({
  CampaignParticipantsModel: {
    findByCampaignId: jest.fn(),
    updateWinnerData: jest.fn(() => Promise.resolve()),
    updateDateReceived: jest.fn(() => Promise.resolve()),
  },
}));

jest.mock('../models/User', () => ({
  UserModel: {
    findByIds: jest.fn(),
  },
}));

jest.mock('../models/Campaign', () => ({
  CampaignModel: {
    findById: jest.fn(),
    updateById: jest.fn(() => Promise.resolve()),
  },
}));

jest.mock('../models/CampaignSugestionBountiesRank', () => ({
  CampaignSugestionBountiesRankModel: {
    findByCampaignId: jest.fn(),
  },
}));

jest.mock('../models/PaymentWinnersLog', () => ({
  PaymentWinnersLogModel: {
    createMany: jest.fn(() => Promise.resolve()),
  },
}));

jest.mock('../utils/cache', () => ({
  earnersCache: { deleteByPrefix: jest.fn(() => Promise.resolve()) },
  campaignsCache: { deleteByPrefix: jest.fn(() => Promise.resolve()) },
}));

jest.mock('../utils/dateUtils', () => ({
  calculateDetailedDeadline: jest.fn(),
}));

// Mock Solana
const mockSendRawTransaction = jest.fn(() => Promise.resolve('mock-sig'));
const mockConfirmTransaction = jest.fn(() => Promise.resolve());

jest.mock('@solana/web3.js', () => ({
  Connection: jest.fn().mockImplementation(() => ({
    getLatestBlockhash: jest.fn(() => Promise.resolve({ blockhash: 'mock', lastValidBlockHeight: 100 })),
    sendRawTransaction: mockSendRawTransaction,
    confirmTransaction: mockConfirmTransaction,
    getSignatureStatus: jest.fn(() => Promise.resolve({ value: { confirmationStatus: 'confirmed' } })),
  })),
  Keypair: {
    fromSecretKey: jest.fn(() => ({
      publicKey: { toBuffer: () => Buffer.alloc(32) },
      secretKey: new Uint8Array(64),
    })),
    fromSeed: jest.fn(),
  },
  PublicKey: jest.fn().mockImplementation((key: string) => ({ toBase58: () => key, toBuffer: () => Buffer.alloc(32) })),
  Transaction: jest.fn().mockImplementation(() => {
    const tx: any = {
      add: jest.fn().mockReturnThis(),
      recentBlockhash: null,
      feePayer: null,
      sign: jest.fn(),
      serialize: jest.fn(() => Buffer.alloc(10)),
    };
    return tx;
  }),
  LAMPORTS_PER_SOL: 1_000_000_000,
  sendAndConfirmTransaction: jest.fn(),
  TransactionExpiredBlockheightExceededError: class extends Error { },
}));

jest.mock('@solana/spl-token', () => ({
  getAssociatedTokenAddress: jest.fn(() => Promise.resolve('mock-token-account')),
  createTransferInstruction: jest.fn(() => 'mock-instruction'),
  getAccount: jest.fn(),
  getMint: jest.fn(() => Promise.resolve({ decimals: 6 })),
  TOKEN_PROGRAM_ID: 'mock-token-program',
}));

jest.mock('bs58', () => ({
  default: { decode: jest.fn(() => new Uint8Array(64)) },
  __esModule: true,
}));

// Mock Sui
jest.mock('@mysten/sui.js/client', () => ({
  SuiClient: jest.fn(),
  getFullnodeUrl: jest.fn(() => 'https://mock-sui-rpc.com'),
}));

jest.mock('@mysten/sui.js/keypairs/ed25519', () => ({
  Ed25519Keypair: {
    fromSecretKey: jest.fn(() => ({
      getPublicKey: () => ({ toSuiAddress: () => 'mock-sui-address' }),
    })),
  },
}));

jest.mock('@mysten/sui/cryptography', () => ({
  decodeSuiPrivateKey: jest.fn(() => ({ schema: 'ED25519', secretKey: new Uint8Array(32) })),
}));

jest.mock('@mysten/sui.js/transactions', () => ({
  TransactionBlock: jest.fn().mockImplementation(() => ({
    splitCoins: jest.fn(() => ['mock-coin']),
    transferObjects: jest.fn(),
    setGasBudget: jest.fn(),
    object: jest.fn(),
    pure: jest.fn(),
    gas: 'mock-gas',
  })),
}));

jest.mock('@mysten/sui.js/utils', () => ({
  fromB64: jest.fn(),
}));

jest.mock('bip39', () => ({
  validateMnemonic: jest.fn(() => false),
  mnemonicToSeedSync: jest.fn(),
}));

jest.mock('ed25519-hd-key', () => ({
  derivePath: jest.fn(),
}));

// Mock EVM
const mockTransferFn = jest.fn();
const mockWaitFn = jest.fn();

jest.mock('ethers', () => ({
  ethers: {
    Contract: jest.fn().mockImplementation(() => ({
      decimals: jest.fn(() => Promise.resolve(6)),
      transfer: mockTransferFn,
    })),
    Wallet: jest.fn().mockImplementation(() => ({})),
    JsonRpcProvider: jest.fn(),
    FetchRequest: jest.fn().mockImplementation(() => ({
      setHeader: jest.fn(),
    })),
    parseUnits: jest.fn(() => BigInt(1000000)),
  },
}));

// Mock Stellar
const mockStellarSubmitTransaction = jest.fn();

jest.mock('@stellar/stellar-sdk', () => {
  const mockServer = {
    loadAccount: jest.fn(() => Promise.resolve({ accountId: () => 'mock-stellar-sender' })),
    fetchBaseFee: jest.fn(() => Promise.resolve(100)),
    submitTransaction: mockStellarSubmitTransaction,
    accounts: jest.fn(() => ({ accountId: jest.fn(() => ({ call: jest.fn() })) })),
    transactions: jest.fn(() => ({ transaction: jest.fn(() => ({ call: jest.fn() })) })),
    operations: jest.fn(() => ({ forTransaction: jest.fn(() => ({ call: jest.fn(() => ({ limit: jest.fn(() => ({ call: jest.fn() })) })) })) })),
  };

  return {
    Horizon: { Server: jest.fn(() => mockServer) },
    StrKey: {
      isValidEd25519PublicKey: jest.fn(() => true),
    },
    Keypair: {
      fromSecret: jest.fn(() => ({
        publicKey: jest.fn(() => 'mock-stellar-public-key'),
        sign: jest.fn(),
      })),
    },
    Asset: jest.fn().mockImplementation(() => ({
      getCode: () => 'USDC',
      getIssuer: () => 'mock-issuer',
    })),
    Networks: { PUBLIC: 'Public Global Stellar Network ; September 2015' },
    TransactionBuilder: jest.fn().mockImplementation(() => ({
      addOperation: jest.fn().mockReturnThis(),
      setTimeout: jest.fn().mockReturnThis(),
      build: jest.fn(() => ({
        sign: jest.fn(),
        toXDR: jest.fn(() => ''),
      })),
    })),
    Operation: {
      payment: jest.fn(() => 'mock-stellar-op'),
    },
  };
});

// Mock consts
jest.mock('../utils/consts', () => ({
  ERC20ABI: [],
  RPCS: { solana: 'https://mock-solana-rpc.com', sui: 'https://mock-sui-rpc.com', base: 'https://mock-evm-rpc.com', stellar: 'https://mock-stellar-rpc.com' },
  TOKENS: {
    solana: { USDT: 'mock-sol-token' },
    sui: { USDT: 'mock-sui-token' },
    base: { USDT: 'mock-evm-token' },
    stellar: { USDC: 'mock-stellar-issuer' },
  },
  WALLETS_DESTINATION: { stellar: 'mock-stellar-destination' },
  PLAN_CORE: {},
  MAX_PARTICIPANTS_LIMIT: 1000,
}));

// ── ENV ──────────────────────────────────────────────────────────────
process.env['SOLANA_PRIVATE_KEY'] = new Array(64).fill(1).join(',');
process.env['SUI_PRIVATE_KEY'] = 'suiprivkey1mock';
process.env['EVM_PRIVATE_KEY'] = '0x' + 'a'.repeat(64);
process.env['STELLAR_PRIVATE_KEY'] = 'SAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA';
process.env['JWT_SECRET'] = 'test-secret';

// ── Imports ──────────────────────────────────────────────────────────
import { PaymentService } from './PaymentService';
import { PaymentModel } from '../models/Payment';
import { CampaignParticipantsModel } from '../models/CampaignParticipants';
import { UserModel } from '../models/User';
import { CampaignModel } from '../models/Campaign';
import { PaymentWinnersLogModel } from '../models/PaymentWinnersLog';

// ── Helpers ──────────────────────────────────────────────────────────

const CAMPAIGN_ID = 'test-campaign-id';

function makeWinners(count: number) {
  return Array.from({ length: count }, (_, i) => ({
    userId: `user-${i + 1}`,
    winner: true,
    amount_received: 10,
    rank: i + 1,
  }));
}

function makeUsersMap(chain: 'sol' | 'sui' | 'evm' | 'stellar', userIds: string[], failIndex?: number) {
  const map = new Map<string, any>();
  userIds.forEach((id, i) => {
    const user: any = { _id: id };
    if (chain === 'sol') user.wallet_sol = i === failIndex ? undefined : `wallet-sol-${id}`;
    if (chain === 'sui') user.wallet_sui = i === failIndex ? undefined : `wallet-sui-${id}`;
    if (chain === 'evm') user.wallet_evm = i === failIndex ? undefined : `0x${id.replace('-', '')}`;
    if (chain === 'stellar') user.wallet_stellar = i === failIndex ? undefined : `G${id.replace('-', '').toUpperCase()}`;
    map.set(id, user);
  });
  return map;
}

function setupMocks(winners: any[], chain: 'sol' | 'sui' | 'evm' | 'stellar', usersMap: Map<string, any>) {
  mockPayments.length = 0;

  (CampaignParticipantsModel.findByCampaignId as jest.Mock).mockResolvedValue({
    participants: winners,
    total: winners.length,
  });

  (UserModel.findByIds as jest.Mock).mockResolvedValue(usersMap);
}

// ── Tests ────────────────────────────────────────────────────────────

describe('PaymentService — falha individual não aborta o loop', () => {
  let service: PaymentService;

  beforeEach(() => {
    service = new PaymentService();
    jest.clearAllMocks();
    mockPayments.length = 0;
  });

  // ─── EVM ─────────────────────────────────────────────────────────

  describe('sendTokenEVM', () => {
    const callSendEVM = () => (service as any).sendTokenEVM('base', 'USDT', CAMPAIGN_ID);

    it('deve processar todos os winners com sucesso', async () => {
      const winners = makeWinners(3);
      const usersMap = makeUsersMap('evm', winners.map(w => w.userId));
      setupMocks(winners, 'evm', usersMap);

      mockTransferFn.mockResolvedValue({ hash: 'tx-hash-mock', wait: mockWaitFn.mockResolvedValue({}) });

      const results = await callSendEVM();

      expect(results.filter((r: any) => r.status === 'confirmed')).toHaveLength(3);
      expect(PaymentModel.create).toHaveBeenCalledTimes(3);
      expect(CampaignParticipantsModel.updateDateReceived).toHaveBeenCalledTimes(3);
    });

    it('deve continuar para os demais quando um transfer falha', async () => {
      const winners = makeWinners(4);
      const usersMap = makeUsersMap('evm', winners.map(w => w.userId));
      setupMocks(winners, 'evm', usersMap);

      mockTransferFn
        .mockResolvedValueOnce({ hash: 'tx-1', wait: jest.fn().mockResolvedValue({}) })
        .mockRejectedValueOnce(new Error('EVM transfer failed'))       // user-2 falha
        .mockResolvedValueOnce({ hash: 'tx-3', wait: jest.fn().mockResolvedValue({}) })
        .mockResolvedValueOnce({ hash: 'tx-4', wait: jest.fn().mockResolvedValue({}) });

      const results = await callSendEVM();

      expect(results.filter((r: any) => r.status === 'confirmed')).toHaveLength(3);
      expect(results.filter((r: any) => r.status === 'failed')).toHaveLength(1);
      expect(results.find((r: any) => r.status === 'failed').error).toBe('EVM transfer failed');
      expect(PaymentModel.create).toHaveBeenCalledTimes(3);
    });

    it('deve continuar quando tx.wait() falha', async () => {
      const winners = makeWinners(3);
      const usersMap = makeUsersMap('evm', winners.map(w => w.userId));
      setupMocks(winners, 'evm', usersMap);

      mockTransferFn
        .mockResolvedValueOnce({ hash: 'tx-1', wait: jest.fn().mockResolvedValue({}) })
        .mockResolvedValueOnce({ hash: 'tx-2', wait: jest.fn().mockRejectedValue(new Error('tx.wait timeout')) })
        .mockResolvedValueOnce({ hash: 'tx-3', wait: jest.fn().mockResolvedValue({}) });

      const results = await callSendEVM();

      expect(results.filter((r: any) => r.status === 'confirmed')).toHaveLength(2);
      expect(results.filter((r: any) => r.status === 'failed')).toHaveLength(1);
    });

    it('deve pular winner sem wallet_evm e registrar como skipped', async () => {
      const winners = makeWinners(3);
      const usersMap = makeUsersMap('evm', winners.map(w => w.userId), 1); // user-2 sem wallet
      setupMocks(winners, 'evm', usersMap);

      mockTransferFn.mockResolvedValue({ hash: 'tx-mock', wait: jest.fn().mockResolvedValue({}) });

      const results = await callSendEVM();

      expect(results.filter((r: any) => r.status === 'confirmed')).toHaveLength(2);
      expect(results.filter((r: any) => r.status === 'skipped')).toHaveLength(1);
      expect(results.find((r: any) => r.status === 'skipped').error).toBe('wallet_evm not configured');
    });

    it('não deve processar winners já pagos', async () => {
      const winners = makeWinners(3);
      const usersMap = makeUsersMap('evm', winners.map(w => w.userId));
      setupMocks(winners, 'evm', usersMap);

      // user-1 já recebeu
      mockPayments.push({ userId: 'user-1', status: 'confirmed' });

      mockTransferFn.mockResolvedValue({ hash: 'tx-mock', wait: jest.fn().mockResolvedValue({}) });

      const results = await callSendEVM();

      expect(results.filter((r: any) => r.status === 'confirmed')).toHaveLength(2);
      expect(PaymentModel.create).toHaveBeenCalledTimes(2);
    });
  });

  // ─── SOL ─────────────────────────────────────────────────────────

  describe('sendTokenSOL', () => {
    const callSendSOL = () => (service as any).sendTokenSOL('USDT', CAMPAIGN_ID);

    it('deve processar todos os winners com sucesso', async () => {
      const winners = makeWinners(3);
      const usersMap = makeUsersMap('sol', winners.map(w => w.userId));
      setupMocks(winners, 'sol', usersMap);

      const results = await callSendSOL();

      expect(results.filter((r: any) => r.status === 'confirmed')).toHaveLength(3);
      expect(PaymentModel.create).toHaveBeenCalledTimes(3);
    });

    it('deve continuar para os demais quando uma transação Solana falha', async () => {
      const winners = makeWinners(4);
      const usersMap = makeUsersMap('sol', winners.map(w => w.userId));
      setupMocks(winners, 'sol', usersMap);

      let callCount = 0;
      mockSendRawTransaction.mockImplementation(() => {
        callCount++;
        if (callCount === 2) throw new Error('Solana RPC error');
        return Promise.resolve('mock-sig-' + callCount);
      });

      const consoleSpy = jest.spyOn(console, 'error').mockImplementation();
      const results = await callSendSOL();

      expect(results.filter((r: any) => r.status === 'confirmed')).toHaveLength(3);
      expect(results.filter((r: any) => r.status === 'failed')).toHaveLength(1);
      expect(PaymentModel.create).toHaveBeenCalledTimes(3);
      consoleSpy.mockRestore();
    });

    it('deve pular winner sem wallet_sol e registrar como skipped', async () => {
      const winners = makeWinners(3);
      const usersMap = makeUsersMap('sol', winners.map(w => w.userId), 0); // user-1 sem wallet
      setupMocks(winners, 'sol', usersMap);

      const results = await callSendSOL();

      expect(results.filter((r: any) => r.status === 'confirmed')).toHaveLength(2);
      expect(results.filter((r: any) => r.status === 'skipped')).toHaveLength(1);
    });
  });

  // ─── SUI ─────────────────────────────────────────────────────────

  describe('sendTokenSUI', () => {
    const callSendSUI = () => (service as any).sendTokenSUI('USDT', CAMPAIGN_ID);

    beforeEach(() => {
      (service as any).getSuiClient = jest.fn().mockResolvedValue({
        getCoins: jest.fn().mockResolvedValue({ data: [{ coinObjectId: 'mock-coin-id' }] }),
        signAndExecuteTransactionBlock: jest.fn().mockResolvedValue({
          digest: 'sui-tx-hash',
          effects: { status: { status: 'success' } },
        }),
      });
    });

    it('deve processar todos os winners com sucesso', async () => {
      const winners = makeWinners(3);
      const usersMap = makeUsersMap('sui', winners.map(w => w.userId));
      setupMocks(winners, 'sui', usersMap);

      const results = await callSendSUI();

      expect(results.filter((r: any) => r.status === 'confirmed')).toHaveLength(3);
      expect(PaymentModel.create).toHaveBeenCalledTimes(3);
    });

    it('deve continuar para os demais quando signAndExecute falha', async () => {
      const winners = makeWinners(4);
      const usersMap = makeUsersMap('sui', winners.map(w => w.userId));
      setupMocks(winners, 'sui', usersMap);

      let callCount = 0;
      (service as any).getSuiClient = jest.fn().mockResolvedValue({
        getCoins: jest.fn().mockResolvedValue({ data: [{ coinObjectId: 'mock-coin-id' }] }),
        signAndExecuteTransactionBlock: jest.fn().mockImplementation(() => {
          callCount++;
          if (callCount === 3) throw new Error('Sui RPC timeout');
          return Promise.resolve({
            digest: `sui-tx-${callCount}`,
            effects: { status: { status: 'success' } },
          });
        }),
      });

      const consoleSpy = jest.spyOn(console, 'error').mockImplementation();
      const results = await callSendSUI();

      expect(results.filter((r: any) => r.status === 'confirmed')).toHaveLength(3);
      expect(results.filter((r: any) => r.status === 'failed')).toHaveLength(1);
      expect(PaymentModel.create).toHaveBeenCalledTimes(3);
      consoleSpy.mockRestore();
    });

    it('deve registrar status failed quando effects.status !== success', async () => {
      const winners = makeWinners(2);
      const usersMap = makeUsersMap('sui', winners.map(w => w.userId));
      setupMocks(winners, 'sui', usersMap);

      let callCount = 0;
      (service as any).getSuiClient = jest.fn().mockResolvedValue({
        getCoins: jest.fn().mockResolvedValue({ data: [{ coinObjectId: 'mock-coin-id' }] }),
        signAndExecuteTransactionBlock: jest.fn().mockImplementation(() => {
          callCount++;
          return Promise.resolve({
            digest: `sui-tx-${callCount}`,
            effects: { status: { status: callCount === 1 ? 'failure' : 'success' } },
          });
        }),
      });

      const results = await callSendSUI();

      expect(results).toHaveLength(2);
      expect(PaymentModel.create).toHaveBeenCalledTimes(2);
      expect(results.find((r: any) => r.userId === 'user-1').status).toBe('failed');
      expect(results.find((r: any) => r.userId === 'user-2').status).toBe('confirmed');
    });

    it('deve pular winner sem wallet_sui e registrar como skipped', async () => {
      const winners = makeWinners(3);
      const usersMap = makeUsersMap('sui', winners.map(w => w.userId), 2); // user-3 sem wallet
      setupMocks(winners, 'sui', usersMap);

      const results = await callSendSUI();

      expect(results.filter((r: any) => r.status === 'confirmed')).toHaveLength(2);
      expect(results.filter((r: any) => r.status === 'skipped')).toHaveLength(1);
    });
  });

  // ─── Stellar ──────────────────────────────────────────────────────

  describe('sendTokenStellar', () => {
    const callSendStellar = () => (service as any).sendTokenStellar('USDC', CAMPAIGN_ID);

    beforeEach(() => {
      mockStellarSubmitTransaction.mockResolvedValue({ hash: 'stellar-tx-hash' });
    });

    it('deve processar todos os winners com sucesso', async () => {
      const winners = makeWinners(3);
      const usersMap = makeUsersMap('stellar', winners.map(w => w.userId));
      setupMocks(winners, 'stellar', usersMap);

      const results = await callSendStellar();

      expect(results.filter((r: any) => r.status === 'confirmed')).toHaveLength(3);
      expect(PaymentModel.create).toHaveBeenCalledTimes(3);
      expect(CampaignParticipantsModel.updateDateReceived).toHaveBeenCalledTimes(3);
    });

    it('deve continuar para os demais quando submitTransaction falha', async () => {
      const winners = makeWinners(4);
      const usersMap = makeUsersMap('stellar', winners.map(w => w.userId));
      setupMocks(winners, 'stellar', usersMap);

      let callCount = 0;
      mockStellarSubmitTransaction.mockImplementation(() => {
        callCount++;
        if (callCount === 2) throw new Error('Stellar submit failed');
        return Promise.resolve({ hash: `stellar-tx-${callCount}` });
      });

      const consoleSpy = jest.spyOn(console, 'error').mockImplementation();
      const results = await callSendStellar();

      expect(results.filter((r: any) => r.status === 'confirmed')).toHaveLength(3);
      expect(results.filter((r: any) => r.status === 'failed')).toHaveLength(1);
      expect(results.find((r: any) => r.status === 'failed').error).toBe('Stellar submit failed');
      expect(PaymentModel.create).toHaveBeenCalledTimes(3);
      consoleSpy.mockRestore();
    });

    it('deve pular winner sem wallet_stellar e registrar como skipped', async () => {
      const winners = makeWinners(3);
      const usersMap = makeUsersMap('stellar', winners.map(w => w.userId), 1); // user-2 sem wallet
      setupMocks(winners, 'stellar', usersMap);

      const results = await callSendStellar();

      expect(results.filter((r: any) => r.status === 'confirmed')).toHaveLength(2);
      expect(results.filter((r: any) => r.status === 'skipped')).toHaveLength(1);
      expect(results.find((r: any) => r.status === 'skipped').error).toBe('wallet_stellar not configured');
    });

    it('não deve processar winners já pagos', async () => {
      const winners = makeWinners(3);
      const usersMap = makeUsersMap('stellar', winners.map(w => w.userId));
      setupMocks(winners, 'stellar', usersMap);

      mockPayments.push({ userId: 'user-1', status: 'confirmed' });

      const results = await callSendStellar();

      expect(results.filter((r: any) => r.status === 'confirmed')).toHaveLength(2);
      expect(PaymentModel.create).toHaveBeenCalledTimes(2);
    });
  });

  // ─── retryFailedPayments ────────────────────────────────────────

  describe('retryFailedPayments', () => {
    it('deve reprocessar apenas winners sem pagamento confirmed', async () => {
      (CampaignModel.findById as jest.Mock).mockResolvedValue({
        _id: CAMPAIGN_ID,
        payment_chain: 'base',
        payment_token: 'USDT',
        status: 'completed',
        rewards_distributed: true,
        payment_received: true,
      });

      const winners = makeWinners(4);
      const usersMap = makeUsersMap('evm', winners.map(w => w.userId));
      setupMocks(winners, 'evm', usersMap);

      // user-1 e user-2 já pagos
      mockPayments.push(
        { userId: 'user-1', status: 'confirmed' },
        { userId: 'user-2', status: 'confirmed' },
      );

      mockTransferFn.mockResolvedValue({ hash: 'retry-tx', wait: jest.fn().mockResolvedValue({}) });

      (PaymentModel.findByCampaignId as jest.Mock)
        .mockResolvedValueOnce(mockPayments)
        .mockResolvedValueOnce(mockPayments)
        .mockResolvedValueOnce([
          { userId: 'user-1', status: 'confirmed' },
          { userId: 'user-2', status: 'confirmed' },
          { userId: 'user-3', status: 'confirmed' },
          { userId: 'user-4', status: 'confirmed' },
        ]);

      const result = await service.retryFailedPayments(CAMPAIGN_ID);

      expect(result.totalUnpaidBefore).toBe(2);
      expect(result.totalRetried).toBe(2);
      expect(result.allPaid).toBe(true);
      expect(CampaignModel.updateById).toHaveBeenCalledWith(CAMPAIGN_ID, expect.objectContaining({ status: 'completed' }));
      expect(PaymentWinnersLogModel.createMany).toHaveBeenCalled();
    });

    it('deve lançar erro se todos já foram pagos', async () => {
      (CampaignModel.findById as jest.Mock).mockResolvedValue({
        _id: CAMPAIGN_ID,
        payment_chain: 'base',
        payment_token: 'USDT',
      });

      const winners = makeWinners(2);
      setupMocks(winners, 'evm', new Map());

      mockPayments.push(
        { userId: 'user-1', status: 'confirmed' },
        { userId: 'user-2', status: 'confirmed' },
      );

      await expect(service.retryFailedPayments(CAMPAIGN_ID)).rejects.toThrow('All winners already received payment');
    });
  });

  // ─── PaymentWinnersLog ──────────────────────────────────────────

  describe('savePaymentLogs', () => {
    it('deve salvar logs para todos os resultados (confirmed, failed, skipped)', async () => {
      const results = [
        { userId: 'u1', wallet: '0x1', amount: 10, status: 'confirmed' as const, signature: 'tx1' },
        { userId: 'u2', wallet: '0x2', amount: 20, status: 'failed' as const, error: 'timeout' },
        { userId: 'u3', wallet: '', amount: 5, status: 'skipped' as const, error: 'wallet not configured' },
      ];

      await (service as any).savePaymentLogs(CAMPAIGN_ID, 'base', 'USDT', results, 'sendTokenWinners');

      expect(PaymentWinnersLogModel.createMany).toHaveBeenCalledTimes(1);
      const entries = (PaymentWinnersLogModel.createMany as jest.Mock).mock.calls[0][0];
      expect(entries).toHaveLength(3);
      expect(entries[0].status).toBe('confirmed');
      expect(entries[1].status).toBe('failed');
      expect(entries[1].error).toBe('timeout');
      expect(entries[2].status).toBe('skipped');
    });
  });
});
