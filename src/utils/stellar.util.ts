import { Keypair, Asset } from '@stellar/stellar-sdk';
import { stellarConfig, stellarServer } from '../config/stellar';

export class StellarUtil {
  static generateKeypair(): Keypair {
    return Keypair.random();
  }

  static isValidPublicKey(publicKey: string): boolean {
    try {
      Keypair.fromPublicKey(publicKey);
      return true;
    } catch {
      return false;
    }
  }

  static async loadAccount(publicKey: string) {
    try {
      return await stellarServer.loadAccount(publicKey);
    } catch (error: any) {
      throw new Error(`Failed to load account ${publicKey}: ${error.message}`);
    }
  }

  static calculateDeadline(days: number): number {
    return Math.floor(Date.now() / 1000) + days * 24 * 60 * 60;
  }

  static getUSDCAsset(): Asset {
    return new Asset(stellarConfig.usdc.code, stellarConfig.usdc.issuer);
  }

  static getTreasuryKeypair(): Keypair {
    if (!stellarConfig.treasury.secretKey) {
      throw new Error('STELLAR_TREASURY_SECRET_KEY not configured');
    }
    return Keypair.fromSecret(stellarConfig.treasury.secretKey);
  }

  static getArbiterKeypair(): Keypair {
    if (!stellarConfig.arbiter.secretKey) {
      throw new Error('STELLAR_ARBITER_SECRET_KEY not configured');
    }
    return Keypair.fromSecret(stellarConfig.arbiter.secretKey);
  }
}
