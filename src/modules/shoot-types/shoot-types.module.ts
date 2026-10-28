import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ShootType } from './shoot-type.entity.js';
import {
  AdminShootTypesController,
  ShootTypesController,
} from './shoot-types.controller.js';
import { ShootTypesService } from './shoot-types.service.js';

@Module({
  imports: [TypeOrmModule.forFeature([ShootType])],
  controllers: [ShootTypesController, AdminShootTypesController],
  providers: [ShootTypesService],
  exports: [ShootTypesService],
})
export class ShootTypesModule {}
