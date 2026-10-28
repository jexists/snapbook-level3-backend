import {
  Body,
  Controller,
  Get,
  HttpCode,
  Post,
  UseGuards,
} from '@nestjs/common';
import { ThrottlerGuard } from '@nestjs/throttler';
import type { AuthUser } from '../../common/auth.types.js';
import { Auth, CurrentUser } from '../../common/decorators/auth.decorator.js';
import { LoginDto, SignupDto } from './auth.dto.js';
import { AuthService } from './auth.service.js';

@Controller('auth')
@UseGuards(ThrottlerGuard)
export class AuthController {
  constructor(private readonly auth: AuthService) {}

  @Post('signup')
  signup(@Body() dto: SignupDto) {
    return this.auth.signup(dto);
  }

  @Post('login')
  @HttpCode(200)
  login(@Body() dto: LoginDto) {
    return this.auth.login(dto);
  }

  @Post('admin/login')
  @HttpCode(200)
  adminLogin(@Body() dto: LoginDto) {
    return this.auth.adminLogin(dto);
  }

  @Get('me')
  @Auth()
  me(@CurrentUser() user: AuthUser) {
    return { id: user.id, role: user.role, name: user.name };
  }
}
