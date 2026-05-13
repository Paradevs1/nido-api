import dotenv from 'dotenv';
dotenv.config();

import { Networks, Horizon } from '@stellar/stellar-sdk';

interface StellarConfig {
  network: 'testnet' | 'mainnet';
  horizonUrl: string;
  networkPassphrase: string;
  treasury: {
    publicKey: string;
    secretKey: string;
  };
  arbiter: {
    publicKey: string;
    secretKey: string;
  };
  usdc: {
    code: string;
    issuer: string;
  };
  defaults: {
    baseFee: string;
    timeout: number;
    deadlineDays: number;
  };
}

const network = (process.env['STELLAR_NETWORK'] || 'testnet') as 'testnet' | 'mainnet';

export const stellarConfig: StellarConfig = {
  network,

  horizonUrl:
    network === 'mainnet'
      ? 'https://horizon.stellar.org'
      : 'https://horizon-testnet.stellar.org',

  networkPassphrase:
    network === 'mainnet' ? Networks.PUBLIC : Networks.TESTNET,

  treasury: {
    publicKey: process.env['STELLAR_TREASURY_PUBLIC_KEY'] || '',
    secretKey: process.env['STELLAR_TREASURY_SECRET_KEY'] || '',
  },

  arbiter: {
    publicKey: process.env['STELLAR_ARBITER_PUBLIC_KEY'] || '',
    secretKey: process.env['STELLAR_ARBITER_SECRET_KEY'] || '',
  },

  usdc: {
    code: 'USDC',
    issuer:
      process.env['STELLAR_USDC_ISSUER'] ||
      (network === 'mainnet'
        ? 'GA5ZSEJYB37JRC5AVCIA5MOP4RHTM335X2KGX3IHOJAPP5RE34K4KZVN'
        : 'GBBD47IF6LWK7P7MDEVSCWR7DPUWV3NY3DTQEVFL4NAT4AQH3ZLLFLA5'),
  },

  defaults: {
    baseFee: '100',
    timeout: 180,
    deadlineDays: 15,
  },
};

export const stellarServer = new Horizon.Server(stellarConfig.horizonUrl);
