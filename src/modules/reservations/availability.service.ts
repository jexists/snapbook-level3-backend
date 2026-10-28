import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { And, LessThan, MoreThan, Not, Repository } from 'typeorm';
import type { Role } from '../../common/auth.types.js';
import {
  addDays,
  formatMinutes,
  kstInstant,
  mondayOf,
  toKstDateKey,
  weekdayOf,
  type DateKey,
} from '../../common/time/kst.js';
import { ShootTypesService } from '../shoot-types/shoot-types.service.js';
import {
  BOOKING_WINDOW_DAYS,
  checkSlot,
  overlaps,
  RULE_MESSAGES,
  SLOT_STARTS,
  slotRange,
  type RuleViolation,
  type TimeRange,
} from './reservation-rules.js';
import { Reservation } from './reservation.entity.js';

export type SlotUnavailableReason = RuleViolation | 'BOOKED';

export interface SlotView {
  time: string;
  available: boolean;
  reason: SlotUnavailableReason | null;
  reasonText: string | null;
}

export interface WeekAvailability {
  weekStart: DateKey;
  shootTypeId: number;
  durationMin: number;
  hasPrevWeek: boolean;
  hasNextWeek: boolean;
  days: { date: DateKey; weekday: number; slots: SlotView[] }[];
}

const BOOKED_TEXT = '이미 예약된 시간이에요.';
const BUSINESS_DAYS = 6; // 월~토

@Injectable()
export class AvailabilityService {
  constructor(
    private readonly shootTypes: ShootTypesService,
    @InjectRepository(Reservation)
    private readonly reservations: Repository<Reservation>,
  ) {}

  /** 주간 달력의 칸마다 예약 가능 여부와 이유를 계산한다 (R1, R2, R4) */
  async week(
    start: DateKey,
    shootTypeId: number,
    role: Role,
    excludeReservationId?: number,
    now = new Date(),
  ): Promise<WeekAvailability> {
    const shootType = await this.shootTypes.getBookable(shootTypeId);
    const weekStart = mondayOf(start);
    const booked = await this.bookedRanges(weekStart, excludeReservationId);

    const days = Array.from({ length: BUSINESS_DAYS }, (_, index) => {
      const date = addDays(weekStart, index);
      const slots = SLOT_STARTS.map((startMinutes): SlotView => {
        const slot = {
          date,
          startMinutes,
          durationMinutes: shootType.durationMin,
        };
        const violation = checkSlot(slot, role, now);
        const reason: SlotUnavailableReason | null =
          violation ??
          (booked.some((range) => overlaps(range, slotRange(slot)))
            ? 'BOOKED'
            : null);
        return {
          time: formatMinutes(startMinutes),
          available: reason === null,
          reason,
          reasonText:
            reason === null
              ? null
              : reason === 'BOOKED'
                ? BOOKED_TEXT
                : RULE_MESSAGES[reason],
        };
      });
      return { date, weekday: weekdayOf(date), slots };
    });

    const today = toKstDateKey(now);
    const firstBookable = role === 'admin' ? today : addDays(today, 1);
    return {
      weekStart,
      shootTypeId,
      durationMin: shootType.durationMin,
      hasPrevWeek: addDays(weekStart, -2) >= firstBookable,
      hasNextWeek: addDays(weekStart, 7) <= addDays(today, BOOKING_WINDOW_DAYS),
      days,
    };
  }

  private async bookedRanges(
    weekStart: DateKey,
    excludeId?: number,
  ): Promise<TimeRange[]> {
    const rows = await this.reservations.find({
      select: { id: true, startAt: true, endAt: true },
      where: {
        status: 'confirmed',
        startAt: And(
          MoreThan(kstInstant(addDays(weekStart, -1))),
          LessThan(kstInstant(addDays(weekStart, 7))),
        ),
        ...(excludeId ? { id: Not(excludeId) } : {}),
      },
    });
    return rows.map((row) => ({ start: row.startAt, end: row.endAt }));
  }
}
