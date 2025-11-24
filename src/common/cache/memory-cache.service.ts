import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

interface CacheItem<T> {
  value: T;
  expiresAt: number;
}

/**
 * In-Memory Cache Service
 * 
 * A lightweight caching solution that doesn't require Redis or any external service.
 * Perfect for small to medium applications or development environments.
 * 
 * Features:
 * - Zero external dependencies
 * - No installation required
 * - No cost
 * - Automatic cleanup of expired entries
 * 
 * Limitations:
 * - Cache is lost on server restart
 * - Not shared across multiple server instances
 * - Limited by server memory
 */
@Injectable()
export class MemoryCacheService {
  private readonly logger = new Logger(MemoryCacheService.name);
  private readonly cache = new Map<string, CacheItem<any>>();
  private readonly isEnabled: boolean;
  private readonly defaultTTL: number = 300; // 5 minutes
  private cleanupInterval: NodeJS.Timeout;

  constructor(private readonly config: ConfigService) {
    this.isEnabled = this.config.get('CACHE_ENABLED', 'true') === 'true';
    
    if (this.isEnabled) {
      this.logger.log('In-memory cache enabled');
      
      // Clean up expired entries every 60 seconds
      this.cleanupInterval = setInterval(() => {
        this.cleanupExpired();
      }, 60000);
    } else {
      this.logger.warn('Caching is disabled');
    }
  }

  /**
   * Get cached value
   */
  async get<T>(key: string): Promise<T | null> {
    if (!this.isEnabled) return null;

    try {
      const item = this.cache.get(key);
      
      if (!item) return null;
      
      // Check if expired
      if (Date.now() > item.expiresAt) {
        this.cache.delete(key);
        return null;
      }
      
      return item.value as T;
    } catch (error) {
      this.logger.error(`Cache get error for key ${key}:`, error);
      return null;
    }
  }

  /**
   * Set cached value with TTL
   */
  async set(key: string, value: any, ttl: number = this.defaultTTL): Promise<void> {
    if (!this.isEnabled) return;

    try {
      const expiresAt = Date.now() + (ttl * 1000);
      this.cache.set(key, { value, expiresAt });
    } catch (error) {
      this.logger.error(`Cache set error for key ${key}:`, error);
    }
  }

  /**
   * Delete cached value
   */
  async del(key: string): Promise<void> {
    if (!this.isEnabled) return;

    try {
      this.cache.delete(key);
    } catch (error) {
      this.logger.error(`Cache delete error for key ${key}:`, error);
    }
  }

  /**
   * Delete multiple keys matching a pattern
   */
  async delPattern(pattern: string): Promise<void> {
    if (!this.isEnabled) return;

    try {
      // Convert Redis-style pattern to regex
      const regexPattern = pattern
        .replace(/\*/g, '.*')
        .replace(/\?/g, '.');
      const regex = new RegExp(`^${regexPattern}$`);

      // Find and delete matching keys
      const keysToDelete: string[] = [];
      for (const key of this.cache.keys()) {
        if (regex.test(key)) {
          keysToDelete.push(key);
        }
      }

      keysToDelete.forEach(key => this.cache.delete(key));
      
      if (keysToDelete.length > 0) {
        this.logger.debug(`Deleted ${keysToDelete.length} keys matching pattern: ${pattern}`);
      }
    } catch (error) {
      this.logger.error(`Cache delete pattern error for pattern ${pattern}:`, error);
    }
  }

  /**
   * Clear all cache
   */
  async clear(): Promise<void> {
    if (!this.isEnabled) return;

    try {
      this.cache.clear();
      this.logger.log('Cache cleared');
    } catch (error) {
      this.logger.error('Cache clear error:', error);
    }
  }

  /**
   * Check if cache is available
   */
  isAvailable(): boolean {
    return this.isEnabled;
  }

  /**
   * Wrap a function with caching
   */
  async wrap<T>(
    key: string,
    ttl: number,
    fn: () => Promise<T>,
  ): Promise<T> {
    // Try to get from cache first
    const cached = await this.get<T>(key);
    if (cached !== null) {
      return cached;
    }

    // Execute function and cache result
    const result = await fn();
    await this.set(key, result, ttl);
    return result;
  }

  /**
   * Get cache statistics
   */
  getStats() {
    return {
      size: this.cache.size,
      enabled: this.isEnabled,
    };
  }

  /**
   * Clean up expired entries
   */
  private cleanupExpired() {
    const now = Date.now();
    let cleanedCount = 0;

    for (const [key, item] of this.cache.entries()) {
      if (now > item.expiresAt) {
        this.cache.delete(key);
        cleanedCount++;
      }
    }

    if (cleanedCount > 0) {
      this.logger.debug(`Cleaned up ${cleanedCount} expired cache entries`);
    }
  }

  /**
   * Cleanup on module destroy
   */
  onModuleDestroy() {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
    }
    this.cache.clear();
  }
}


