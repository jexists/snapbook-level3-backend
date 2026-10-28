import {
  addDays,
  kstInstant,
  weekdayOf,
  type DateKey,
} from '../../common/time/kst.js';
import type { ReservationStatus } from '../reservations/reservation.constants.js';
import type { SeedReservation } from './seed-data.js';

export interface ScheduledSeed {
  item: SeedReservation;
  startAt: Date;
  endAt: Date;
  status: ReservationStatus;
}

/**
 * 가상 예약을 실제 날짜에 배치한다.
 * - 일요일은 피한다 (미래·오늘은 다음 날로, 과거는 전날로)
 * - 확정 예약끼리 겹치면 다음 영업일로 옮긴다 (DB의 겹침 제약을 지키기 위해)
 * - 오늘 예약 중 이미 끝난 것은 촬영 완료로 둔다
 */
export function scheduleSeeds(
  items: SeedReservation[],
  durationOf: (shootTypeIndex: number) => number,
  today: DateKey,
  now: Date,
): ScheduledSeed[] {
  const confirmed: { start: number; end: number }[] = [];
  return items.map((item) => {
    const [hours, minutes] = item.time.split(':').map(Number);
    const durationMs = durationOf(item.shootType) * 60_000;
    const step = item.dayOffset < 0 ? -1 : 1;
    let date = skipSunday(addDays(today, item.dayOffset), step);

    const rangeOn = (day: DateKey) => {
      const start = kstInstant(day, hours * 60 + minutes).getTime();
      return { start, end: start + durationMs };
    };
    const clashes = (day: DateKey) => {
      const range = rangeOn(day);
      return confirmed.some(
        (other) => range.start < other.end && other.start < range.end,
      );
    };

    const isFutureBooking = item.status === 'confirmed';
    while (isFutureBooking && clashes(date))
      date = skipSunday(addDays(date, 1), 1);

    const range = rangeOn(date);
    const status =
      item.status === 'confirmed' && range.end <= now.getTime()
        ? 'completed'
        : item.status;
    if (status === 'confirmed') confirmed.push(range);
    return {
      item,
      startAt: new Date(range.start),
      endAt: new Date(range.end),
      status,
    };
  });
}

function skipSunday(date: DateKey, step: number): DateKey {
  return weekdayOf(date) === 0 ? addDays(date, step) : date;
}
