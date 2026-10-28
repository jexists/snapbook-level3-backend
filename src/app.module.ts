import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { ThrottlerModule } from '@nestjs/throttler';
import { validateEnv } from './config/env.js';
import { DatabaseModule } from './database/database.module.js';
import { AiNotesModule } from './modules/ai-notes/ai-notes.module.js';
import { AuthModule } from './modules/auth/auth.module.js';
import { CustomersModule } from './modules/customers/customers.module.js';
import { HealthModule } from './modules/health/health.module.js';
import { ReservationsModule } from './modules/reservations/reservations.module.js';
import { SeedModule } from './modules/seed/seed.module.js';
import { ShootTypesModule } from './modules/shoot-types/shoot-types.module.js';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true, validate: validateEnv }),
    // 로그인·가입 시도 제한: 1분에 20번
    ThrottlerModule.forRoot([{ ttl: 60_000, limit: 20 }]),
    DatabaseModule,
    HealthModule,
    AuthModule,
    CustomersModule,
    ShootTypesModule,
    ReservationsModule,
    AiNotesModule,
    SeedModule,
  ],
})
export class AppModule {}
