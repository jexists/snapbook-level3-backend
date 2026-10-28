import { Controller, HttpCode, Post } from '@nestjs/common';
import { Auth } from '../../common/decorators/auth.decorator.js';
import { SeedService } from './seed.service.js';

@Controller('admin/seed')
@Auth('admin')
export class SeedController {
  constructor(private readonly seed: SeedService) {}

  @Post('reset')
  @HttpCode(200)
  reset() {
    return this.seed.reset();
  }
}
