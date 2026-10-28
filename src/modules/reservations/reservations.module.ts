import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AiNotesModule } from '../ai-notes/ai-notes.module.js';
import { CustomersModule } from '../customers/customers.module.js';
import { ShootTypesModule } from '../shoot-types/shoot-types.module.js';
import { AdminReservationsController } from './admin-reservations.controller.js';
import { AvailabilityService } from './availability.service.js';
import { Reservation } from './reservation.entity.js';
import { ReservationQueriesService } from './reservation-queries.service.js';
import {
  AvailabilityController,
  ReservationsController,
} from './reservations.controller.js';
import { ReservationsService } from './reservations.service.js';

@Module({
  imports: [
    TypeOrmModule.forFeature([Reservation]),
    AiNotesModule,
    CustomersModule,
    ShootTypesModule,
  ],
  controllers: [
    AvailabilityController,
    ReservationsController,
    AdminReservationsController,
  ],
  providers: [
    AvailabilityService,
    ReservationsService,
    ReservationQueriesService,
  ],
})
export class ReservationsModule {}
