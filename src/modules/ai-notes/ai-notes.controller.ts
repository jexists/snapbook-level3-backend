import { Controller, Param, ParseIntPipe, Post } from '@nestjs/common';
import { Auth } from '../../common/decorators/auth.decorator.js';
import { AiNotesService } from './ai-notes.service.js';

@Controller('admin/reservations/:id/ai-note')
@Auth('admin')
export class AiNotesController {
  constructor(private readonly aiNotes: AiNotesService) {}

  @Post()
  regenerate(@Param('id', ParseIntPipe) id: number) {
    return this.aiNotes.regenerate(id);
  }
}
