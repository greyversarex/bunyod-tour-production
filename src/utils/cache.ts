/**
 * Simple in-memory cache with TTL (Time-To-Live)
 * Optimized for tour data caching to reduce database queries
 */

interface CacheEntry<T> {
  data: T;
  expiresAt: number;
}

class SimpleCache {
  private cache: Map<string, CacheEntry<any>> = new Map();
  private defaultTTL: number = 60000; // 60 seconds default

  /**
   * Get value from cache
   * @param key Cache key
   * @returns Cached value or undefined if expired/not found
   */
  get<T>(key: string): T | undefined {
    const entry = this.cache.get(key);
    
    if (!entry) {
      return undefined;
    }
    
    if (Date.now() > entry.expiresAt) {
      this.cache.delete(key);
      return undefined;
    }
    
    return entry.data as T;
  }

  /**
   * Set value in cache with optional TTL
   * @param key Cache key
   * @param value Value to cache
   * @param ttl Time-to-live in milliseconds (default: 60 seconds)
   */
  set<T>(key: string, value: T, ttl: number = this.defaultTTL): void {
    this.cache.set(key, {
      data: value,
      expiresAt: Date.now() + ttl,
    });
  }

  /**
   * Delete specific key from cache
   */
  delete(key: string): boolean {
    return this.cache.delete(key);
  }

  /**
   * Clear all cache entries matching a pattern
   */
  clearPattern(pattern: string): void {
    for (const key of this.cache.keys()) {
      if (key.includes(pattern)) {
        this.cache.delete(key);
      }
    }
  }

  /**
   * Clear all cache entries
   */
  clear(): void {
    this.cache.clear();
  }

  /**
   * Get cache statistics
   */
  stats(): { size: number; keys: string[] } {
    return {
      size: this.cache.size,
      keys: Array.from(this.cache.keys()),
    };
  }
}

export const tourCache = new SimpleCache();

export const CACHE_KEYS = {
  TOUR_BLOCKS: 'tour_blocks',
  TOUR_BLOCK_TOURS: (blockId: number) => `tour_block_${blockId}_tours`,
  ALL_TOURS: 'all_tours',
  EXCHANGE_RATES: 'exchange_rates',
  COUNTRIES: 'countries',
  CITIES: 'cities',
};

export const CACHE_TTL = {
  TOUR_BLOCKS: 2 * 60 * 1000, // 2 minutes
  TOURS: 2 * 60 * 1000, // 2 minutes  
  EXCHANGE_RATES: 30 * 60 * 1000, // 30 minutes
  STATIC_DATA: 5 * 60 * 1000, // 5 minutes for countries/cities
};
