import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseIntPipe,
  Patch,
  Post,
} from '@nestjs/common';
import { Auth } from '../../common/decorators/auth.decorator.js';
import { CreateShootTypeDto, UpdateShootTypeDto } from './shoot-type.dto.js';
import { ShootTypesService } from './shoot-types.service.js';

/** 누구나 볼 수 있는 촬영 종류 */
@Controller('shoot-types')
export class ShootTypesController {
  constructor(private readonly shootTypes: ShootTypesService) {}

  @Get()
  list() {
    return this.shootTypes.list();
  }

  @Get(':id')
  get(@Param('id', ParseIntPipe) id: number) {
    return this.shootTypes.get(id);
  }
}

/** 관리자만 쓰는 촬영 종류 관리 */
@Controller('admin/shoot-types')
@Auth('admin')
export class AdminShootTypesController {
  constructor(private readonly shootTypes: ShootTypesService) {}

  @Get()
  list() {
    return this.shootTypes.list(true);
  }

  @Post()
  create(@Body() dto: CreateShootTypeDto) {
    return this.shootTypes.create(dto);
  }

  @Patch(':id')
  update(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateShootTypeDto,
  ) {
    return this.shootTypes.update(id, dto);
  }

  @Delete(':id')
  remove(@Param('id', ParseIntPipe) id: number) {
    return this.shootTypes.remove(id);
  }
}
