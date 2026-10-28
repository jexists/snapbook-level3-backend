import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Reservation } from '../reservations/reservation.entity.js';
import { AiNote } from './ai-note.entity.js';
import { AiNotesController } from './ai-notes.controller.js';
import { AiNotesService } from './ai-notes.service.js';

@Module({
  imports: [TypeOrmModule.forFeature([AiNote, Reservation])],
  controllers: [AiNotesController],
  providers: [AiNotesService],
  exports: [AiNotesService],
})
export class AiNotesModule {}
