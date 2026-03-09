import { redis } from "../db/redis";

const DEFAULT_TTL = 60 * 5; // 5 minutes

/**
 * Get a value from cache. Returns null if missing or on error (graceful degradation).
 */
export async function cacheGet<T>(key: string): Promise<T | null> {
  try {
    const raw = await redis.get(key);
    if (!raw) return null;
    return JSON.parse(raw) as T;
  } catch {
    return null;
  }
}

/**
 * Set a value in cache with optional TTL in seconds.
 */
export async function cacheSet(
  key: string,
  value: unknown,
  ttlSeconds: number = DEFAULT_TTL
): Promise<void> {
  try {
    const serialized = JSON.stringify(value);
    await redis.setex(key, ttlSeconds, serialized);
  } catch (err) {
    console.error("cacheSet error:", err);
    // Don't throw — caching is best-effort
  }
}

/**
 * Delete a single key.
 */
export async function cacheDel(key: string): Promise<void> {
  try {
    await redis.del(key);
  } catch (err) {
    console.error("cacheDel error:", err);
  }
}

/**
 * Delete all keys matching a pattern (e.g. "product:list:*").
 */
export async function cacheDelPattern(pattern: string): Promise<void> {
  try {
    const keys = await redis.keys(pattern);
    if (keys.length > 0) await redis.del(...keys);
  } catch (err) {
    console.error("cacheDelPattern error:", err);
  }
}

/**
 * Centralized key builders — keeps naming consistent and avoids typos.
 */
export const cacheKeys = {
  publicProduct: (id: string) => `product:public:${id}`,
  publicProductList: (filtersHash: string) => `product:list:${filtersHash}`,
  session: (tokenHash: string) => `session:${tokenHash}`,
};
