import {
  Body,
  Controller,
  Get,
  Param,
  ParseIntPipe,
  Post,
  Query,
} from '@nestjs/common';
import type { AuthUser } from '../../common/auth.types.js';
import { Auth, CurrentUser } from '../../common/decorators/auth.decorator.js';
import { AvailabilityService } from './availability.service.js';
import {
  ChangeReservationDto,
  CreateReservationDto,
  MyReservationsQueryDto,
  WeekQueryDto,
} from './reservation.dto.js';
import { ReservationsService } from './reservations.service.js';

/** 주간 달력의 예약 가능 칸 (손님·관리자 공통, 역할에 따라 날짜 범위가 다름) */
@Controller('availability')
@Auth('customer', 'admin')
export class AvailabilityController {
  constructor(private readonly availability: AvailabilityService) {}

  @Get('week')
  week(@Query() query: WeekQueryDto, @CurrentUser() user: AuthUser) {
    return this.availability.week(
      query.start,
      query.shootTypeId,
      user.role,
      query.excludeReservationId,
    );
  }
}

/** 손님이 쓰는 예약 기능 */
@Controller('reservations')
@Auth('customer')
export class ReservationsController {
  constructor(private readonly reservations: ReservationsService) {}

  @Post()
  create(@CurrentUser() user: AuthUser, @Body() dto: CreateReservationDto) {
    return this.reservations.createByCustomer(user, dto);
  }

  @Get('mine')
  listMine(
    @CurrentUser() user: AuthUser,
    @Query() query: MyReservationsQueryDto,
  ) {
    return this.reservations.listMine(user, query.filter);
  }

  @Get(':id')
  get(@CurrentUser() user: AuthUser, @Param('id', ParseIntPipe) id: number) {
    return this.reservations.getMine(user, id);
  }

  @Post(':id/cancel')
  cancel(@CurrentUser() user: AuthUser, @Param('id', ParseIntPipe) id: number) {
    return this.reservations.cancel(user, id);
  }

  @Post(':id/change')
  change(
    @CurrentUser() user: AuthUser,
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: ChangeReservationDto,
  ) {
    return this.reservations.change(user, id, dto);
  }
}
