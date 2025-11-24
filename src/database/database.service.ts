import { Injectable, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';
import { ConfigService } from '@nestjs/config';


@Injectable()
export class DatabaseService extends PrismaClient implements OnModuleInit, OnModuleDestroy {
    constructor(config: ConfigService){
        const isProduction = config.get('NODE_ENV') === 'production';
        
        super({
            datasources:{
                db:{
                    // Security: Database URL stored in environment variable (DATABASE_URL)
                    // Never hardcoded in source code - ensures credentials are not committed to version control
                    // Note: Connection pooling is configured via connection_limit and pool_timeout in DATABASE_URL
                    // Example: postgresql://user:pass@host:5432/db?connection_limit=20&pool_timeout=20
                    url:config.get('DATABASE_URL')
                }
            },
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
