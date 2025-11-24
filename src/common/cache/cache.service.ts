import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Redis from 'ioredis';
import { MemoryCacheService } from './memory-cache.service';

@Injectable()
export class CacheService {
  private readonly logger = new Logger(CacheService.name);
  private redis: Redis | null = null;
  private readonly isEnabled: boolean;
  private readonly defaultTTL: number = 300; // 5 minutes
  private readonly useRedis: boolean;
  private memoryCache: MemoryCacheService;

  constructor(private readonly config: ConfigService) {
    // Check if caching is enabled
    this.isEnabled = this.config.get('CACHE_ENABLED', 'true') === 'true';
    
    // Check if Redis should be used (default: false - use memory cache)
    this.useRedis = this.config.get('USE_REDIS', 'false') === 'true';
    
    // Initialize memory cache (always available as fallback)
    this.memoryCache = new MemoryCacheService(config);
    
    if (this.isEnabled && this.useRedis) {
      // Use Redis if explicitly enabled
      try {
        this.redis = new Redis({
          host: this.config.get('REDIS_HOST', 'localhost'),
          port: this.config.get('REDIS_PORT', 6379),
          password: this.config.get('REDIS_PASSWORD'),
          db: this.config.get('REDIS_DB', 0),
          retryStrategy: (times: number) => {
            const delay = Math.min(times * 50, 2000);
            return delay;
          },
          maxRetriesPerRequest: 3,
          enableReadyCheck: true,
          lazyConnect: true,
        });

        this.redis.on('error', (err) => {
          this.logger.error('Redis connection error:', err);
        });

        this.redis.on('connect', () => {
          this.logger.log('✅ Redis connected successfully');
        });

        // Connect to Redis
        this.redis.connect().catch((err) => {
          this.logger.error('Failed to connect to Redis, falling back to memory cache:', err);
          this.redis = null;
        });
      } catch (error) {
        this.logger.error('Failed to initialize Redis, using memory cache:', error);
        this.redis = null;
      }
    } else if (this.isEnabled) {
      this.logger.log('✅ Using in-memory cache (no Redis needed)');
    } else {
      this.logger.warn('Caching is disabled');
    }
  }

  /**
   * Get cached value
   */
  async get<T>(key: string): Promise<T | null> {
    // Use Redis if available, otherwise use memory cache
    if (this.redis) {
      try {
        const value = await this.redis.get(key);
        if (!value) return null;
        return JSON.parse(value) as T;
      } catch (error) {
        this.logger.error(`Redis get error for key ${key}:`, error);
        return null;
      }
    }
    
    // Fallback to memory cache
    return this.memoryCache.get<T>(key);
  }

  /**
   * Set cached value with TTL
   */
  async set(key: string, value: any, ttl: number = this.defaultTTL): Promise<void> {
    // Use Redis if available, otherwise use memory cache
    if (this.redis) {
      try {
        const stringValue = JSON.stringify(value);
        await this.redis.setex(key, ttl, stringValue);
      } catch (error) {
        this.logger.error(`Redis set error for key ${key}:`, error);
      }
      return;
    }
    
    // Fallback to memory cache
    await this.memoryCache.set(key, value, ttl);
  }

  /**
   * Delete cached value
   */
  async del(key: string): Promise<void> {
    // Use Redis if available, otherwise use memory cache
    if (this.redis) {
      try {
        await this.redis.del(key);
      } catch (error) {
        this.logger.error(`Redis delete error for key ${key}:`, error);
      }
      return;
    }
    
    // Fallback to memory cache
    await this.memoryCache.del(key);
  }

  /**
   * Delete multiple keys matching a pattern
   */
  async delPattern(pattern: string): Promise<void> {
    // Use Redis if available, otherwise use memory cache
    if (this.redis) {
      try {
        const keys = await this.redis.keys(pattern);
        if (keys.length > 0) {
          await this.redis.del(...keys);
        }
      } catch (error) {
        this.logger.error(`Redis delete pattern error for pattern ${pattern}:`, error);
      }
      return;
    }
    
    // Fallback to memory cache
    await this.memoryCache.delPattern(pattern);
  }

  /**
   * Clear all cache
   */
  async clear(): Promise<void> {
    // Use Redis if available, otherwise use memory cache
    if (this.redis) {
      try {
        await this.redis.flushdb();
      } catch (error) {
        this.logger.error('Redis clear error:', error);
      }
      return;
    }
    
    // Fallback to memory cache
    await this.memoryCache.clear();
  }

  /**
   * Check if cache is available
   */
  isAvailable(): boolean {
    if (this.redis) {
      return this.redis.status === 'ready';
    }
    return this.memoryCache.isAvailable();
  }

  /**
   * Get cache type being used
   */
  getCacheType(): 'redis' | 'memory' | 'none' {
    if (!this.isEnabled) return 'none';
    if (this.redis && this.redis.status === 'ready') return 'redis';
    return 'memory';
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
}

