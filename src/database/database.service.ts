import { Injectable, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';
import { ConfigService } from '@nestjs/config';


@Injectable()
export class DatabaseService extends PrismaClient implements OnModuleInit, OnModuleDestroy {
    constructor(config: ConfigService){
        super({
            datasources:{
                db:{
                    // Security: Database URL stored in environment variable (DATABASE_URL)
                    // Never hardcoded in source code - ensures credentials are not committed to version control
                    // url:process.env.DATABASE_URL
                    url:config.get('DATABASE_URL')
                }
            },
            log: ['query', 'info', 'warn', 'error'],
        })
    }

    async onModuleInit() {
        await this.$connect();
    }

    async onModuleDestroy() {
        await this.$disconnect();
    }
}
