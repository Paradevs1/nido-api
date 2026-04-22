import { Redis } from '@upstash/redis';

// ── Cache interface ────────────────────────────────────────────────────────────
export interface ICache {
  get<T>(key: string): Promise<T | null> | T | null;
  set<T>(key: string, data: T, ttl?: number): Promise<void> | void;
  delete(key: string): Promise<void> | void;
  deleteByPrefix(prefix: string): Promise<void> | void;
  generateCampaignsKey(page: number, limit: number, filters: any): string;
  generateCommentsKey(campaignId: string, page: number, limit: number, currentUserId?: string): string;
}

// ── In-Memory Cache (fallback) ─────────────────────────────────────────────────
interface CacheEntry<T> {
  data: T;
  expiresAt: number;
  lastAccessed: number;
}

class InMemoryCache implements ICache {
  private cache: Map<string, CacheEntry<any>>;
  private defaultTTL: number;
  private maxSize: number;
  private cleanupInterval: NodeJS.Timeout | null = null;

  constructor(defaultTTL: number = 60000, maxSize: number = 1000) {
    this.cache = new Map();
    this.defaultTTL = defaultTTL;
    this.maxSize = maxSize;

    if (typeof process !== 'undefined' && process.env['NODE_ENV'] !== 'production') {
      this.cleanupInterval = setInterval(() => this.cleanExpired(), 60000);
    }
  }

  private generateKey(prefix: string, params: any): string {
    return `${prefix}:${JSON.stringify(params)}`;
  }

  get<T>(key: string): T | null {
    const entry = this.cache.get(key);
    if (!entry) return null;
    if (Date.now() > entry.expiresAt) {
      this.cache.delete(key);
      return null;
    }
    entry.lastAccessed = Date.now();
    return entry.data as T;
  }

  set<T>(key: string, data: T, ttl?: number): void {
    if (this.cache.size >= this.maxSize && !this.cache.has(key)) {
      this.evictLRU();
    }
    const now = Date.now();
    this.cache.set(key, { data, expiresAt: now + (ttl || this.defaultTTL), lastAccessed: now });
    if (this.cache.size > this.maxSize * 0.8) this.cleanExpired();
  }

  delete(key: string): void {
    this.cache.delete(key);
  }

  deleteByPrefix(prefix: string): void {
    for (const key of this.cache.keys()) {
      if (key.startsWith(prefix)) this.cache.delete(key);
    }
  }

  private cleanExpired(): void {
    const now = Date.now();
    for (const [key, entry] of this.cache.entries()) {
      if (now > entry.expiresAt) this.cache.delete(key);
    }
  }

  private evictLRU(): void {
    if (this.cache.size === 0) return;
    let oldestKey: string | null = null;
    let oldestTime = Infinity;
    for (const [key, entry] of this.cache.entries()) {
      if (entry.lastAccessed < oldestTime) { oldestTime = entry.lastAccessed; oldestKey = key; }
    }
    if (oldestKey) this.cache.delete(oldestKey);
  }

  generateCampaignsKey(page: number, limit: number, filters: any): string {
    return this.generateKey('campaigns:all', { page, limit, filters });
  }

  generateCommentsKey(campaignId: string, page: number, limit: number, currentUserId?: string): string {
    return this.generateKey('comments:campaign', { campaignId, page, limit, currentUserId });
  }
}

// ── Redis Cache (Upstash) ──────────────────────────────────────────────────────
class RedisCache implements ICache {
  private redis: Redis;
  private defaultTTLSeconds: number;
  private prefix: string;

  constructor(redis: Redis, defaultTTLSeconds: number = 300, prefix: string = '') {
    this.redis = redis;
    this.defaultTTLSeconds = defaultTTLSeconds;
    this.prefix = prefix;
  }

  private fullKey(key: string): string {
    return this.prefix ? `${this.prefix}:${key}` : key;
  }

  private generateKey(prefix: string, params: any): string {
    return `${prefix}:${JSON.stringify(params)}`;
  }

  async get<T>(key: string): Promise<T | null> {
    const value = await this.redis.get<T>(this.fullKey(key));
    return value ?? null;
  }

  async set<T>(key: string, data: T, ttlMs?: number): Promise<void> {
    const ttlSeconds = ttlMs ? Math.ceil(ttlMs / 1000) : this.defaultTTLSeconds;
    await this.redis.set(this.fullKey(key), data, { ex: ttlSeconds });
  }

  async delete(key: string): Promise<void> {
    await this.redis.del(this.fullKey(key));
  }

  async deleteByPrefix(prefix: string): Promise<void> {
    const pattern = this.fullKey(`${prefix}*`);
    let cursor = 0;
    do {
      const result = await this.redis.scan(cursor, { match: pattern, count: 100 });
      cursor = Number(result[0]);
      const keys = result[1] as string[];
      if (keys && keys.length > 0) {
        await this.redis.del(...keys);
      }
    } while (cursor !== 0);
  }

  generateCampaignsKey(page: number, limit: number, filters: any): string {
    return this.generateKey('campaigns:all', { page, limit, filters });
  }

  generateCommentsKey(campaignId: string, page: number, limit: number, currentUserId?: string): string {
    return this.generateKey('comments:campaign', { campaignId, page, limit, currentUserId });
  }
}

// ── Factory: Redis if configured, else in-memory ───────────────────────────────
function createCache(defaultTTLMs: number, maxSize: number, redisPrefix: string): ICache {
  const redisUrl = process.env['UPSTASH_REDIS_REST_URL'];
  const redisToken = process.env['UPSTASH_REDIS_REST_TOKEN'];

  if (redisUrl && redisToken) {
    const redis = new Redis({ url: redisUrl, token: redisToken });
    const ttlSeconds = Math.ceil(defaultTTLMs / 1000);
    return new RedisCache(redis, ttlSeconds, redisPrefix);
  }

  return new InMemoryCache(defaultTTLMs, maxSize);
}

// ── Singleton instances ────────────────────────────────────────────────────────
export const campaignsCache: ICache = createCache(300000, 500, 'bounties:campaigns'); // 5 min
export const earnersCache: ICache = createCache(300000, 100, 'bounties:earners');     // 5 min
export const commentsCache: ICache = createCache(300000, 500, 'bounties:comments');   // 5 min
