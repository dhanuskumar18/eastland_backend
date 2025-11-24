import { Injectable, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';
import { ConfigService } from '@nestjs/config';
import { Pool } from 'pg';
import { PrismaPg } from '@prisma/adapter-pg';


@Injectable()
export class DatabaseService extends PrismaClient implements OnModuleInit, OnModuleDestroy {
    constructor(config: ConfigService){
        const isProduction = config.get('NODE_ENV') === 'production';
        const databaseUrl = config.get<string>('DATABASE_URL');
        
        if (!databaseUrl) {
            throw new Error('DATABASE_URL environment variable is required');
        }
        
        // Prisma 7 configuration - using adapter for direct database connection
        // Create PostgreSQL connection pool with optimized settings
        const pool = new Pool({
            connectionString: databaseUrl,
            max: 20, // Maximum number of clients in the pool
            idleTimeoutMillis: 30000, // Close idle clients after 30 seconds
            connectionTimeoutMillis: 2000, // Return an error after 2 seconds if connection could not be established
        });
        
        // Create Prisma adapter with the connection pool
        const adapter = new PrismaPg(pool);
        
        super({
            adapter: adapter,
            // Optimize logging: only log errors in production, reduced logging in dev
            log: isProduction 
                ? ['error'] 
                : ['error'], // Only log errors to reduce overhead
        })
    }

    async onModuleInit() {
        await this.$connect();
    }

    async onModuleDestroy() {
        await this.$disconnect();
    }

    // Helper method to enable query result caching
    enableCache() {
        this.$on('query' as never, () => {
            // Hook for potential query caching
        });
    }
}
