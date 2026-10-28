import {
  Body,
  Controller,
  Get,
  Param,
  ParseIntPipe,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import type { AuthUser } from '../../common/auth.types.js';
import { Auth, CurrentUser } from '../../common/decorators/auth.decorator.js';
import {
  AdminCreateReservationDto,
  ChangeReservationDto,
  DateQueryDto,
  MonthQueryDto,
  SearchReservationsQueryDto,
  UpdateStatusDto,
} from './reservation.dto.js';
import { ReservationQueriesService } from './reservation-queries.service.js';
import { ReservationsService } from './reservations.service.js';

/** 관리자만 쓰는 예약 조회·관리 */
@Controller('admin')
@Auth('admin')
export class AdminReservationsController {
  constructor(
    private readonly queries: ReservationQueriesService,
    private readonly reservations: ReservationsService,
  ) {}

  @Get('calendar/month')
  month(@Query() query: MonthQueryDto) {
    return this.queries.month(query.month);
  }

  @Get('calendar/week')
  week(@Query() query: DateQueryDto) {
    return this.queries.week(query.date);
  }

  @Get('calendar/day')
  day(@Query() query: DateQueryDto) {
    return this.queries.day(query.date);
  }

  @Get('stats')
  stats(@Query() query: MonthQueryDto) {
    return this.queries.stats(query.month);
  }

  @Get('reservations')
  search(@Query() query: SearchReservationsQueryDto) {
    return this.queries.search(query);
  }

  @Get('reservations/:id')
  detail(@Param('id', ParseIntPipe) id: number) {
    return this.queries.detail(id);
  }

  @Post('reservations')
  async create(@Body() dto: AdminCreateReservationDto) {
    return this.queries.detail(await this.reservations.createByAdmin(dto));
  }

  @Patch('reservations/:id/status')
  updateStatus(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateStatusDto,
  ) {
    return this.queries.updateStatus(id, dto);
  }

  @Post('reservations/:id/cancel')
  async cancel(
    @CurrentUser() user: AuthUser,
    @Param('id', ParseIntPipe) id: number,
  ) {
    await this.reservations.cancel(user, id);
    return this.queries.detail(id);
  }

  @Post('reservations/:id/change')
  async change(
    @CurrentUser() user: AuthUser,
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: ChangeReservationDto,
  ) {
    const { id: newId } = await this.reservations.change(user, id, dto);
    return this.queries.detail(newId);
  }
}
