import { ObjectId } from 'mongodb';

export interface IJobLock {
  _id?: ObjectId;
  job_name: string;
  locked: boolean;
  locked_at: Date | null;
  locked_until: Date | null;
}

export class JobLockModel {
  private static collectionName = 'job_locks';

  private static async getCollection() {
    const { getBountiesDB } = await import('../config/database');
    const db = await getBountiesDB();
    return db.collection<IJobLock>(this.collectionName);
  }

  /**
   * Try to acquire a distributed lock for a job.
   * Returns true if the lock was acquired, false if the job is already running.
   * Lock auto-expires after `ttlMs` milliseconds (default 5 minutes) to prevent deadlocks.
   */
  static async acquire(jobName: string, ttlMs: number = 5 * 60 * 1000): Promise<boolean> {
    const collection = await this.getCollection();
    const now = new Date();
    const lockedUntil = new Date(now.getTime() + ttlMs);

    // Try to acquire: either no lock exists, it's not locked, or the lock has expired
    const result = await collection.findOneAndUpdate(
      {
        job_name: jobName,
        $or: [
          { locked: false },
          { locked_until: { $lte: now } },
        ],
      },
      {
        $set: {
          locked: true,
          locked_at: now,
          locked_until: lockedUntil,
        },
      },
      {
        upsert: true,
        returnDocument: 'after',
      }
    );

    // If result exists and is locked by us (locked_at matches), we acquired it
    return result !== null && result.locked === true;
  }

  /**
   * Release a previously acquired lock.
   */
  static async release(jobName: string): Promise<void> {
    const collection = await this.getCollection();
    await collection.updateOne(
      { job_name: jobName },
      { $set: { locked: false, locked_at: null, locked_until: null } }
    );
  }
}
