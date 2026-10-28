import {
  ConflictException,
  Injectable,
  Logger,
  OnApplicationBootstrap,
} from '@nestjs/common';
import bcrypt from 'bcryptjs';
import { DataSource, EntityManager } from 'typeorm';
import { toKstDateKey } from '../../common/time/kst.js';
import { DB_SCHEMA } from '../../database/database.constants.js';
import { AiNote } from '../ai-notes/ai-note.entity.js';
import { Customer } from '../customers/customer.entity.js';
import { Reservation } from '../reservations/reservation.entity.js';
import type { ReservationStatus } from '../reservations/reservation.constants.js';
import { ShootType } from '../shoot-types/shoot-type.entity.js';
import {
  SEED_CUSTOMERS,
  SEED_PASSWORD,
  SEED_RESERVATIONS,
  SEED_SHOOT_TYPES,
} from './seed-data.js';
import { scheduleSeeds } from './seed-schedule.js';

const ACTIVE: ReservationStatus[] = ['confirmed', 'completed', 'no_show'];

@Injectable()
export class SeedService implements OnApplicationBootstrap {
  private readonly logger = new Logger(SeedService.name);
  private running = false;

  constructor(private readonly dataSource: DataSource) {}

  /** 처음 켰을 때 데이터가 비어 있으면 한 번 채워서 빈 화면을 막는다 */
  async onApplicationBootstrap() {
    if ((await this.dataSource.getRepository(Customer).count()) === 0) {
      await this.reset();
      this.logger.log('가상 데이터를 처음으로 채웠어요');
    }
  }

  /** 예약·손님·촬영 종류·AI 정리를 지우고 오늘 기준으로 다시 채운다. 관리자 계정은 그대로 둔다. */
  async reset(now = new Date()) {
    if (this.running)
      throw new ConflictException(
        '가상 데이터를 채우는 중이에요. 잠시만 기다려 주세요.',
      );
    this.running = true;
    try {
      const counts = await this.dataSource.transaction((manager) =>
        this.fill(manager, now),
      );
      return { ...counts, message: '가상 데이터를 다시 채웠어요.' };
    } finally {
      this.running = false;
    }
  }

  private async fill(manager: EntityManager, now: Date) {
    await manager.query(
      `TRUNCATE ${DB_SCHEMA}.ai_notes, ${DB_SCHEMA}.reservations, ${DB_SCHEMA}.customers, ${DB_SCHEMA}.shoot_types RESTART IDENTITY CASCADE`,
    );

    const shootTypes = await manager.save(
      SEED_SHOOT_TYPES.map((fields) =>
        manager.create(ShootType, { ...fields, isActive: true }),
      ),
    );
    const passwordHash = await bcrypt.hash(SEED_PASSWORD, 10);
    const customers = await manager.save(
      SEED_CUSTOMERS.map((fields) =>
        manager.create(Customer, {
          ...fields,
          passwordHash: fields.loginId ? passwordHash : null,
        }),
      ),
    );

    const scheduled = scheduleSeeds(
      SEED_RESERVATIONS,
      (index) => shootTypes[index].durationMin,
      toKstDateKey(now),
      now,
    );
    const savedByKey = new Map<string, Reservation>();
    let noteCount = 0;
    for (const { item, startAt, endAt, status } of scheduled) {
      const shootType = shootTypes[item.shootType];
      const bookedAt = addMinutes(startAt, -3 * 24 * 60);
      const reservation = await manager.save(
        manager.create(Reservation, {
          customerId: customers[item.customer].id,
          shootTypeId: shootType.id,
          startAt,
          endAt,
          headcount: item.headcount,
          purpose: item.purpose ?? null,
          specialRequest: item.specialRequest ?? null,
          channel: item.channel,
          termsAgreedAt: item.channel === 'online' ? bookedAt : null,
          priceAtBooking: shootType.price,
          status,
          changedFromId: item.changedFrom
            ? (savedByKey.get(item.changedFrom)?.id ?? null)
            : null,
          cancelledAt: ACTIVE.includes(status)
            ? null
            : addMinutes(startAt, -2 * 24 * 60),
          createdAt: bookedAt,
        }),
      );
      savedByKey.set(item.key, reservation);

      if (item.note) {
        const { oneLine, ...content } = item.note;
        await manager.save(
          manager.create(AiNote, {
            reservationId: reservation.id,
            status: 'done',
            content,
            oneLine,
            generatedAt: bookedAt,
          }),
        );
        noteCount += 1;
      }
    }

    return {
      shootTypes: shootTypes.length,
      customers: customers.length,
      reservations: savedByKey.size,
      aiNotes: noteCount,
    };
  }
}

function addMinutes(instant: Date, minutes: number) {
  return new Date(instant.getTime() + minutes * 60_000);
}
