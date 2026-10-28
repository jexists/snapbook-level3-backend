import { Global, Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtModule } from '@nestjs/jwt';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AuthGuard } from '../../common/guards/auth.guard.js';
import type { AppEnv } from '../../config/env.js';
import { CustomersModule } from '../customers/customers.module.js';
import { Admin } from './admin.entity.js';
import { AuthController } from './auth.controller.js';
import { AuthService } from './auth.service.js';

/** 다른 모듈의 @Auth()가 AuthGuard를 쓸 수 있도록 전역 모듈로 둔다 */
@Global()
@Module({
  imports: [
    TypeOrmModule.forFeature([Admin]),
    CustomersModule,
    JwtModule.registerAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService<AppEnv, true>) => ({
        secret: config.get('JWT_SECRET', { infer: true }),
        signOptions: { expiresIn: '7d' },
      }),
    }),
  ],
  controllers: [AuthController],
  providers: [AuthService, AuthGuard],
  exports: [JwtModule, AuthGuard],
})
export class AuthModule {}
