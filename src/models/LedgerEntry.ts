import { ClientSession, ObjectId } from 'mongodb';

/**
 * Lançamento imutável do ledger double-entry do saldo do Host.
 * Ver docs/ESTRATEGIA_SALDO_HOST_E_CAMPANHA_ACEITACAO/02 §2 e 04 §2.
 *
 * Valores (`delta_available`/`delta_reserved`/`balance_after`) são SEMPRE em unidades
 * mínimas inteiras do token (ver utils/decimal). Entradas nunca são editadas ou
 * apagadas — correções são novos lançamentos compensatórios.
 */

export type LedgerEntryType =
  | 'DEPOSIT'
  | 'WITHDRAWAL_HOLD'
  | 'WITHDRAWAL_SETTLED'
  | 'WITHDRAWAL_REVERTED'
  | 'CAMPAIGN_RESERVE'
  | 'CAMPAIGN_PAYOUT'
  | 'CAMPAIGN_RELEASE'
  | 'FEE';

export type LedgerRefType = 'deposit' | 'withdrawal' | 'campaign' | 'application' | 'fee';

export interface ILedgerEntry {
  _id?: ObjectId;
  hostId: string;
  chain: string;
  token: string;
  type: LedgerEntryType;
  delta_available: number; // minor units; pode ser negativo
  delta_reserved: number; // minor units; pode ser negativo
  ref_type: LedgerRefType;
  ref_id: string;
  balance_after: { available: number; reserved: number };
  meta?: { txHash?: string };
  created_at: Date;
}

export class LedgerEntryModel {
  private static collectionName = 'ledger_entries';

  static async getCollection() {
    const { getBountiesDB } = await import('../config/database');
    const db = await getBountiesDB();
    return db.collection<ILedgerEntry>(this.collectionName);
  }

  static async ensureIndexes(): Promise<void> {
    const collection = await this.getCollection();
    await Promise.all([
      collection.createIndex({ hostId: 1, chain: 1, token: 1, created_at: -1 }),
      collection.createIndex({ ref_type: 1, ref_id: 1 }),
      // Idempotência de depósito/saque: o mesmo txHash nunca é creditado/liquidado 2x.
      collection.createIndex(
        { 'meta.txHash': 1 },
        { unique: true, sparse: true, name: 'meta_txHash_unique' }
      ),
    ]);
  }

  /** Insere um lançamento dentro de uma sessão/transação Mongo. */
  static async insert(
    entry: Omit<ILedgerEntry, '_id' | 'created_at'>,
    session?: ClientSession
  ): Promise<ILedgerEntry> {
    const collection = await this.getCollection();
    const doc: ILedgerEntry = { ...entry, created_at: new Date() };
    const result = await collection.insertOne(doc, session ? { session } : {});
    return { ...doc, _id: result.insertedId };
  }

  static async listByHost(
    hostId: string,
    opts: { chain?: string; token?: string; limit?: number; skip?: number } = {}
  ): Promise<ILedgerEntry[]> {
    const collection = await this.getCollection();
    const filter: Record<string, unknown> = { hostId };
    if (opts.chain) filter['chain'] = opts.chain;
    if (opts.token) filter['token'] = opts.token;
    return await collection
      .find(filter)
      .sort({ created_at: -1 })
      .skip(opts.skip ?? 0)
      .limit(opts.limit ?? 50)
      .toArray();
  }

  static async findByRef(refType: LedgerRefType, refId: string): Promise<ILedgerEntry[]> {
    const collection = await this.getCollection();
    return await collection.find({ ref_type: refType, ref_id: refId }).toArray();
  }
}
