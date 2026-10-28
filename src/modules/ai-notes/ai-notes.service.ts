import {
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
  ServiceUnavailableException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import OpenAI from 'openai';
import { Repository } from 'typeorm';
import type { AppEnv } from '../../config/env.js';
import { Reservation } from '../reservations/reservation.entity.js';
import { AiNote, type AiNoteStatus } from './ai-note.entity.js';
import {
  AI_NOTE_INSTRUCTIONS,
  AI_NOTE_SCHEMA,
  buildAiNoteInput,
  hasRequestText,
  type AiNoteOutput,
} from './ai-note-prompt.js';

const NO_KEY_MESSAGE =
  'GPT 키가 설정되지 않았어요. backend/.env의 GPT_API_KEY를 확인해 주세요.';

@Injectable()
export class AiNotesService {
  private readonly logger = new Logger(AiNotesService.name);
  private client: OpenAI | null = null;

  constructor(
    private readonly config: ConfigService<AppEnv, true>,
    @InjectRepository(AiNote) private readonly notes: Repository<AiNote>,
    @InjectRepository(Reservation)
    private readonly reservations: Repository<Reservation>,
  ) {}

  /** 예약이 저장된 뒤 부른다. 예약 응답을 늦추지 않도록 기다리지 않는다. */
  requestFor(reservationId: number) {
    void this.generate(reservationId).catch((error: unknown) =>
      this.logger.error(`AI 정리 실패 (예약 ${reservationId})`, error),
    );
  }

  /** 예약 변경: 요청 글이 같으면 기존 정리를 옮겨 쓰고, 다르면 새로 만든다 */
  async copyOrRequest(fromId: number, toId: number) {
    const [from, to, note] = await Promise.all([
      this.reservations.findOneBy({ id: fromId }),
      this.reservations.findOneBy({ id: toId }),
      this.notes.findOneBy({ reservationId: fromId }),
    ]);
    const sameText =
      from &&
      to &&
      from.purpose === to.purpose &&
      from.specialRequest === to.specialRequest;
    if (note?.status === 'done' && sameText) {
      await this.save(
        toId,
        'done',
        note.content,
        note.oneLine,
        note.generatedAt,
      );
      return;
    }
    this.requestFor(toId);
  }

  /**
   * 관리자의 "AI 다시 정리". 키가 없거나 GPT가 실패하면 오류로 알려 주고,
   * 이미 저장된 정리는 덮어쓰지 않는다.
   */
  async regenerate(reservationId: number) {
    const reservation = await this.loadWithShootType(reservationId);
    if (!reservation) throw new NotFoundException('예약을 찾을 수 없어요.');
    if (!hasRequestText(reservation)) {
      throw new BadRequestException('정리할 요청 글이 없어요.');
    }
    const client = this.getClient();
    if (!client) throw new BadRequestException(NO_KEY_MESSAGE);

    try {
      return await this.saveOutput(
        reservationId,
        await this.ask(client, reservation),
      );
    } catch (error) {
      this.logger.error(`GPT 호출 실패 (예약 ${reservationId})`, error);
      throw new ServiceUnavailableException(
        'AI 정리를 만들지 못했어요. 잠시 뒤 다시 시도해 주세요.',
      );
    }
  }

  /** 예약 직후 자동 정리. 결과(완료·실패·키 없음)를 그대로 저장한다. */
  private async generate(reservationId: number) {
    const reservation = await this.loadWithShootType(reservationId);
    if (!reservation || !hasRequestText(reservation)) return;

    const client = this.getClient();
    if (!client) {
      await this.save(reservationId, 'no_key', null, null);
      return;
    }
    try {
      await this.saveOutput(reservationId, await this.ask(client, reservation));
    } catch (error) {
      this.logger.error(`GPT 호출 실패 (예약 ${reservationId})`, error);
      await this.save(reservationId, 'failed', null, null);
    }
  }

  private async ask(client: OpenAI, reservation: Reservation) {
    const response = await client.responses.create({
      model: this.config.get('GPT_MODEL', { infer: true }),
      instructions: AI_NOTE_INSTRUCTIONS,
      input: buildAiNoteInput({
        shootType: reservation.shootType.name,
        headcount: reservation.headcount,
        purpose: reservation.purpose,
        specialRequest: reservation.specialRequest,
      }),
      text: {
        format: {
          type: 'json_schema',
          name: 'ai_note',
          schema: AI_NOTE_SCHEMA,
          strict: true,
        },
      },
    });
    return JSON.parse(response.output_text) as AiNoteOutput;
  }

  private saveOutput(reservationId: number, output: AiNoteOutput) {
    const { oneLine, ...content } = output;
    return this.save(reservationId, 'done', content, oneLine.slice(0, 200));
  }

  private loadWithShootType(id: number) {
    return this.reservations.findOne({
      where: { id },
      relations: { shootType: true },
    });
  }

  private getClient(): OpenAI | null {
    const apiKey = this.config.get('GPT_API_KEY', { infer: true });
    if (!apiKey) return null;
    this.client ??= new OpenAI({ apiKey });
    return this.client;
  }

  private async save(
    reservationId: number,
    status: AiNoteStatus,
    content: AiNote['content'],
    oneLine: string | null,
    generatedAt = new Date(),
  ) {
    await this.notes.upsert(
      { reservationId, status, content, oneLine, generatedAt },
      ['reservationId'],
    );
    return this.notes.findOneByOrFail({ reservationId });
  }
}
