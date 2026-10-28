import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { JwtService } from '@nestjs/jwt';
import type { Request } from 'express';
import { ROLES_KEY, type AuthUser, type Role } from '../auth.types.js';

export interface AuthedRequest extends Request {
  user: AuthUser;
}

/** 로그인 토큰을 확인하고, @Auth()에 적힌 역할만 통과시킨다. */
@Injectable()
export class AuthGuard implements CanActivate {
  constructor(
    private readonly jwt: JwtService,
    private readonly reflector: Reflector,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<AuthedRequest>();
    const token = request.headers.authorization?.replace(/^Bearer\s+/i, '');
    if (!token) throw new UnauthorizedException('로그인이 필요해요.');

    try {
      request.user = await this.jwt.verifyAsync<AuthUser>(token);
    } catch {
      throw new UnauthorizedException(
        '로그인이 만료됐어요. 다시 로그인해 주세요.',
      );
    }

    const roles = this.reflector.getAllAndOverride<Role[]>(ROLES_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (roles.length > 0 && !roles.includes(request.user.role)) {
      throw new ForbiddenException('볼 수 있는 권한이 없어요.');
    }
    return true;
  }
}
