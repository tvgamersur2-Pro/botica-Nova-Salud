/**
 * Simple in-memory cache for frequently accessed data.
 *
 * Provides TTL-based caching without external dependencies.
 * Suitable for caching product lists, supplier lists, and alert stats
 * that change infrequently.
 *
 * Requirements: NFR-1.1, NFR-1.3
 */

import { logger } from './logger';

// ----------------------------------------------------------------
// Cache entry
// ----------------------------------------------------------------

interface CacheEntry<T> {
  value: T;
  expiresAt: number; // Unix timestamp in ms
}

// ----------------------------------------------------------------
// Cache class
// ----------------------------------------------------------------

class MemoryCache {
  private store = new Map<string, CacheEntry<unknown>>();
  private cleanupInterval: ReturnType<typeof setInterval> | null = null;

  constructor() {
    // Run cleanup every 5 minutes to remove expired entries
    this.cleanupInterval = setInterval(() => this.cleanup(), 5 * 60 * 1000);
    // Allow the process to exit even if this interval is running
    if (this.cleanupInterval.unref) {
      this.cleanupInterval.unref();
    }
  }

  /**
   * Stores a value in the cache with a TTL in seconds.
   */
  set<T>(key: string, value: T, ttlSeconds: number): void {
    this.store.set(key, {
      value,
      expiresAt: Date.now() + ttlSeconds * 1000,
    });
    logger.debug('Cache set', { key, ttlSeconds });
  }

  /**
   * Retrieves a value from the cache.
   * Returns null if the key does not exist or has expired.
   */
  get<T>(key: string): T | null {
    const entry = this.store.get(key) as CacheEntry<T> | undefined;

    if (!entry) return null;

    if (Date.now() > entry.expiresAt) {
      this.store.delete(key);
      return null;
    }

    logger.debug('Cache hit', { key });
    return entry.value;
  }

  /**
   * Removes a specific key from the cache.
   */
  invalidate(key: string): void {
    this.store.delete(key);
    logger.debug('Cache invalidated', { key });
  }

  /**
   * Removes all keys matching a prefix pattern.
   */
  invalidatePattern(prefix: string): void {
    let count = 0;
    for (const key of this.store.keys()) {
      if (key.startsWith(prefix)) {
        this.store.delete(key);
        count++;
      }
    }
    logger.debug('Cache pattern invalidated', { prefix, count });
  }

  /**
   * Clears the entire cache.
   */
  clear(): void {
    this.store.clear();
    logger.debug('Cache cleared');
  }

  /**
   * Returns the number of entries currently in the cache.
   */
  size(): number {
    return this.store.size;
  }

  /**
   * Removes all expired entries from the cache.
   */
  private cleanup(): void {
    const now = Date.now();
    let removed = 0;
    for (const [key, entry] of this.store.entries()) {
      if (now > entry.expiresAt) {
        this.store.delete(key);
        removed++;
      }
    }
    if (removed > 0) {
      logger.debug('Cache cleanup', { removed, remaining: this.store.size });
    }
  }

  /**
   * Stops the cleanup interval (for graceful shutdown).
   */
  destroy(): void {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
      this.cleanupInterval = null;
    }
  }
}

// ----------------------------------------------------------------
// Singleton instance
// ----------------------------------------------------------------

export const cache = new MemoryCache();

// ----------------------------------------------------------------
// Cache key helpers
// ----------------------------------------------------------------

export const CacheKeys = {
  productList:   (page: number, limit: number) => `products:list:${page}:${limit}`,
  product:       (id: string)                  => `products:${id}`,
  supplierList:  (page: number, limit: number) => `suppliers:list:${page}:${limit}`,
  supplier:      (id: string)                  => `suppliers:${id}`,
  alertStats:    ()                            => 'alerts:stats',
  alertList:     (page: number, limit: number) => `alerts:list:${page}:${limit}`,
} as const;

// ----------------------------------------------------------------
// TTL constants (seconds)
// ----------------------------------------------------------------

export const CacheTTL = {
  SHORT:  30,   // 30 seconds – frequently changing data
  MEDIUM: 300,  // 5 minutes  – moderately changing data
  LONG:   3600, // 1 hour     – rarely changing data
} as const;
