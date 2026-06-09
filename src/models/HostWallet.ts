import { ClientSession, ObjectId } from 'mongodb';

/**
 * Snapshot materializado do saldo do Host por (host, chain, token).
 * É derivável do ledger (`ledger_entries`) — serve como cache de leitura rápida e
 * para a checagem de invariante dentro da transação. A fonte de verdade é o ledger.
 *
 * `available` e `reserved` em unidades mínimas inteiras do token; invariante:
 * available ≥ 0 e reserved ≥ 0 sempre. Mutado SÓ pelo WalletService dentro de txn.
 */
export interface IHostWallet {
  _id?: ObjectId;
  hostId: string;
  chain: string;
  token: string;
  available: number; // minor units, ≥ 0
  reserved: number; // minor units, ≥ 0
  updated_at: Date;
}

export class HostWalletModel {
  private static collectionName = 'host_wallets';

  static async getCollection() {
    const { getBountiesDB } = await import('../config/database');
    const db = await getBountiesDB();
    return db.collection<IHostWallet>(this.collectionName);
  }

  static async ensureIndexes(): Promise<void> {
    const collection = await this.getCollection();
    await collection.createIndex(
      { hostId: 1, chain: 1, token: 1 },
      { unique: true, name: 'host_chain_token_unique' }
    );
  }

  static async find(
    hostId: string,
    chain: string,
    token: string,
    session?: ClientSession
  ): Promise<IHostWallet | null> {
    const collection = await this.getCollection();
    return await collection.findOne({ hostId, chain, token }, session ? { session } : {});
  }

  static async listByHost(hostId: string): Promise<IHostWallet[]> {
    const collection = await this.getCollection();
    return await collection.find({ hostId }).toArray();
  }

  /**
   * Aplica deltas (em minor units) ao snapshot dentro de uma transação, criando o doc
   * se ainda não existe. Não valida invariante — quem chama (WalletService) garante
   * que o resultado é ≥ 0 ANTES de chamar.
   */
  static async applyDelta(
    hostId: string,
    chain: string,
    token: string,
    deltaAvailable: number,
    deltaReserved: number,
    session?: ClientSession
  ): Promise<void> {
    const collection = await this.getCollection();
    await collection.updateOne(
      { hostId, chain, token },
      {
        $inc: { available: deltaAvailable, reserved: deltaReserved },
        $setOnInsert: { hostId, chain, token },
        $set: { updated_at: new Date() },
      },
      { upsert: true, ...(session ? { session } : {}) }
    );
  }
}
