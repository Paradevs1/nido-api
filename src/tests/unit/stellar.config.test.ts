import { Networks } from '@stellar/stellar-sdk';

// We test the config module directly, so we must NOT mock it here.
// We control env vars instead.

describe('StellarConfig', () => {
  const ORIGINAL_ENV = process.env;

  beforeEach(() => {
    jest.resetModules(); // force fresh module load for each test
    process.env = { ...ORIGINAL_ENV };
  });

  afterAll(() => {
    process.env = ORIGINAL_ENV;
  });

  // ─── Network selection ───────────────────────────────────────────────────────

  describe('network selection', () => {
    it('defaults to testnet when STELLAR_NETWORK is not set', async () => {
      delete process.env['STELLAR_NETWORK'];
      const { stellarConfig } = await import('../../config/stellar');
      expect(stellarConfig.network).toBe('testnet');
    });

    it('uses testnet Horizon URL on testnet', async () => {
      process.env['STELLAR_NETWORK'] = 'testnet';
      const { stellarConfig } = await import('../../config/stellar');
      expect(stellarConfig.horizonUrl).toBe('https://horizon-testnet.stellar.org');
    });

    it('uses mainnet Horizon URL on mainnet', async () => {
      process.env['STELLAR_NETWORK'] = 'mainnet';
      const { stellarConfig } = await import('../../config/stellar');
      expect(stellarConfig.horizonUrl).toBe('https://horizon.stellar.org');
    });

    it('uses testnet passphrase on testnet', async () => {
      process.env['STELLAR_NETWORK'] = 'testnet';
      const { stellarConfig } = await import('../../config/stellar');
      expect(stellarConfig.networkPassphrase).toBe(Networks.TESTNET);
    });

    it('uses mainnet passphrase on mainnet', async () => {
      process.env['STELLAR_NETWORK'] = 'mainnet';
      const { stellarConfig } = await import('../../config/stellar');
      expect(stellarConfig.networkPassphrase).toBe(Networks.PUBLIC);
    });
  });

  // ─── Treasury / Arbiter keys ─────────────────────────────────────────────────

  describe('treasury and arbiter configuration', () => {
    it('reads STELLAR_TREASURY_PUBLIC_KEY from env', async () => {
      process.env['STELLAR_TREASURY_PUBLIC_KEY'] = 'GABC_TREASURY';
      const { stellarConfig } = await import('../../config/stellar');
      expect(stellarConfig.treasury.publicKey).toBe('GABC_TREASURY');
    });

    it('reads STELLAR_TREASURY_SECRET_KEY from env', async () => {
      process.env['STELLAR_TREASURY_SECRET_KEY'] = 'SABC_TREASURY';
      const { stellarConfig } = await import('../../config/stellar');
      expect(stellarConfig.treasury.secretKey).toBe('SABC_TREASURY');
    });

    it('reads STELLAR_ARBITER_PUBLIC_KEY from env', async () => {
      process.env['STELLAR_ARBITER_PUBLIC_KEY'] = 'GABC_ARBITER';
      const { stellarConfig } = await import('../../config/stellar');
      expect(stellarConfig.arbiter.publicKey).toBe('GABC_ARBITER');
    });

    it('falls back to empty string when treasury key is missing', async () => {
      // Set to '' rather than delete so dotenv.config() inside the module
      // won't re-populate from the local .env file on reimport.
      process.env['STELLAR_TREASURY_PUBLIC_KEY'] = '';
      process.env['STELLAR_TREASURY_SECRET_KEY'] = '';
      const { stellarConfig } = await import('../../config/stellar');
      expect(stellarConfig.treasury.publicKey).toBe('');
      expect(stellarConfig.treasury.secretKey).toBe('');
    });
  });

  // ─── USDC issuer ─────────────────────────────────────────────────────────────

  describe('USDC issuer', () => {
    it('uses STELLAR_USDC_ISSUER from env when set', async () => {
      process.env['STELLAR_USDC_ISSUER'] = 'GCUSTOM_ISSUER';
      const { stellarConfig } = await import('../../config/stellar');
      expect(stellarConfig.usdc.issuer).toBe('GCUSTOM_ISSUER');
    });

    it('falls back to testnet Circle issuer on testnet when not set', async () => {
      // Set to '' so dotenv won't re-populate from local .env
      process.env['STELLAR_USDC_ISSUER'] = '';
      process.env['STELLAR_NETWORK'] = 'testnet';
      const { stellarConfig } = await import('../../config/stellar');
      expect(stellarConfig.usdc.issuer).toBe(
        'GBBD47IF6LWK7P7MDEVSCWR7DPUWV3NY3DTQEVFL4NAT4AQH3ZLLFLA5'
      );
    });

    it('falls back to mainnet Circle issuer on mainnet when not set', async () => {
      process.env['STELLAR_USDC_ISSUER'] = '';
      process.env['STELLAR_NETWORK'] = 'mainnet';
      const { stellarConfig } = await import('../../config/stellar');
      expect(stellarConfig.usdc.issuer).toBe(
        'GA5ZSEJYB37JRC5AVCIA5MOP4RHTM335X2KGX3IHOJAPP5RE34K4KZVN'
      );
    });

    it('USDC code is always USDC', async () => {
      const { stellarConfig } = await import('../../config/stellar');
      expect(stellarConfig.usdc.code).toBe('USDC');
    });
  });

  // ─── Defaults ────────────────────────────────────────────────────────────────

  describe('defaults', () => {
    it('has baseFee of 100', async () => {
      const { stellarConfig } = await import('../../config/stellar');
      expect(stellarConfig.defaults.baseFee).toBe('100');
    });

    it('has timeout of 180', async () => {
      const { stellarConfig } = await import('../../config/stellar');
      expect(stellarConfig.defaults.timeout).toBe(180);
    });

    it('has deadlineDays of 15', async () => {
      const { stellarConfig } = await import('../../config/stellar');
      expect(stellarConfig.defaults.deadlineDays).toBe(15);
    });
  });

  // ─── Horizon Server instance ─────────────────────────────────────────────────

  describe('stellarServer', () => {
    it('exports a stellarServer object', async () => {
      const { stellarServer } = await import('../../config/stellar');
      expect(stellarServer).toBeDefined();
    });

    it('stellarServer has a loadAccount method', async () => {
      const { stellarServer } = await import('../../config/stellar');
      expect(typeof stellarServer.loadAccount).toBe('function');
    });
  });
});
