import {
  addDays,
  kstInstant,
  toKstDateKey,
  weekdayOf,
} from '../../common/time/kst.js';
import { SEED_RESERVATIONS, SEED_SHOOT_TYPES } from './seed-data.js';
import { scheduleSeeds } from './seed-schedule.js';

const durationOf = (index: number) => SEED_SHOOT_TYPES[index].durationMin;

describe('가상 예약 배치', () => {
  // 월요일(2026-10-26)부터 일요일까지 어느 요일에 채워도 규칙이 지켜지는지 본다
  const days = Array.from({ length: 7 }, (_, index) =>
    addDays('2026-10-26', index),
  );

  it.each(days)(
    '%s에 채우면 일요일이 없고 확정 예약끼리 겹치지 않는다',
    (today) => {
      const now = kstInstant(today, 9 * 60);
      const scheduled = scheduleSeeds(
        SEED_RESERVATIONS,
        durationOf,
        today,
        now,
      );

      expect(
        scheduled.every(
          ({ startAt }) => weekdayOf(toKstDateKey(startAt)) !== 0,
        ),
      ).toBe(true);

      const confirmed = scheduled.filter((seed) => seed.status === 'confirmed');
      for (const a of confirmed) {
        for (const b of confirmed) {
          if (a === b) continue;
          expect(a.startAt < b.endAt && b.startAt < a.endAt).toBe(false);
        }
      }
    },
  );

  it('오늘 이미 끝난 예약은 촬영 완료가 된다', () => {
    const today = '2026-10-27';
    const scheduled = scheduleSeeds(
      SEED_RESERVATIONS,
      durationOf,
      today,
      kstInstant(today, 15 * 60),
    );
    const morning = scheduled.find((seed) => seed.item.key === 't1');
    expect(morning?.status).toBe('completed');
    const evening = scheduled.find((seed) => seed.item.key === 't3');
    expect(evening?.status).toBe('confirmed');
  });
});
