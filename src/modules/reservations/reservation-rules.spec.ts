import { kstInstant } from '../../common/time/kst.js';
import {
  canMarkResult,
  checkBusinessHours,
  checkSlot,
  customerDeadline,
  isBeforeCustomerDeadline,
  overlaps,
  SLOT_STARTS,
} from './reservation-rules.js';

// 2026-10-27(화) 14:00 한국 시간
const now = kstInstant('2026-10-27', 14 * 60);
const at = (hhmm: string) => {
  const [h, m] = hhmm.split(':').map(Number);
  return h * 60 + m;
};

describe('영업시간 규칙 (R2)', () => {
  it('일요일은 막는다', () => {
    expect(
      checkBusinessHours({
        date: '2026-11-01',
        startMinutes: at('10:00'),
        durationMinutes: 30,
      }),
    ).toBe('SUNDAY');
  });

  it('30분 단위가 아니면 막는다', () => {
    expect(
      checkBusinessHours({
        date: '2026-10-28',
        startMinutes: at('10:15'),
        durationMinutes: 30,
      }),
    ).toBe('NOT_ON_SLOT');
  });

  it('18:00을 넘기면 막는다 (60분 촬영 17:30 시작)', () => {
    expect(
      checkBusinessHours({
        date: '2026-10-28',
        startMinutes: at('17:30'),
        durationMinutes: 60,
      }),
    ).toBe('OUTSIDE_HOURS');
  });

  it('17:30 시작 30분 촬영은 된다', () => {
    expect(
      checkBusinessHours({
        date: '2026-10-28',
        startMinutes: at('17:30'),
        durationMinutes: 30,
      }),
    ).toBeNull();
  });

  it('점심시간과 겹치면 막는다 (60분 촬영 11:30 시작)', () => {
    expect(
      checkBusinessHours({
        date: '2026-10-28',
        startMinutes: at('11:30'),
        durationMinutes: 60,
      }),
    ).toBe('LUNCH');
  });

  it('점심 직전에 끝나거나 직후에 시작하면 된다', () => {
    expect(
      checkBusinessHours({
        date: '2026-10-28',
        startMinutes: at('11:00'),
        durationMinutes: 60,
      }),
    ).toBeNull();
    expect(
      checkBusinessHours({
        date: '2026-10-28',
        startMinutes: at('13:00'),
        durationMinutes: 60,
      }),
    ).toBeNull();
  });

  it('시작 칸은 10:00~17:30 16개', () => {
    expect(SLOT_STARTS).toHaveLength(16);
    expect(SLOT_STARTS[0]).toBe(at('10:00'));
    expect(SLOT_STARTS.at(-1)).toBe(at('17:30'));
  });
});

describe('예약 가능 날짜 (R2, R4)', () => {
  const slot = (date: string, hhmm = '10:00') => ({
    date,
    startMinutes: at(hhmm),
    durationMinutes: 30,
  });

  it('손님은 당일 예약을 할 수 없다', () => {
    expect(checkSlot(slot('2026-10-27', '16:00'), 'customer', now)).toBe(
      'SAME_DAY',
    );
  });

  it('관리자는 오늘 남은 시간에 넣을 수 있다', () => {
    expect(checkSlot(slot('2026-10-27', '16:00'), 'admin', now)).toBeNull();
  });

  it('지난 시간은 누구도 넣을 수 없다', () => {
    expect(checkSlot(slot('2026-10-27', '10:00'), 'admin', now)).toBe('PAST');
  });

  it('30일 뒤까지는 되고 31일 뒤는 안 된다', () => {
    expect(checkSlot(slot('2026-11-26'), 'customer', now)).toBeNull();
    expect(checkSlot(slot('2026-11-27'), 'customer', now)).toBe('TOO_FAR');
  });

  it('내일 촬영은 오늘 18:00 전까지만 손님이 신청할 수 있다', () => {
    expect(checkSlot(slot('2026-10-28'), 'customer', now)).toBeNull();
    const evening = kstInstant('2026-10-27', 18 * 60);
    expect(checkSlot(slot('2026-10-28'), 'customer', evening)).toBe(
      'BOOKING_CLOSED',
    );
    expect(checkSlot(slot('2026-10-28'), 'admin', evening)).toBeNull();
  });
});

describe('손님 취소·변경 마감 (R3)', () => {
  const shoot = kstInstant('2026-10-28', 10 * 60);

  it('마감은 촬영 전날 18:00', () => {
    expect(customerDeadline(shoot).toISOString()).toBe(
      kstInstant('2026-10-27', 18 * 60).toISOString(),
    );
  });

  it('17:59에는 되고 18:00에는 안 된다', () => {
    expect(
      isBeforeCustomerDeadline(shoot, kstInstant('2026-10-27', 17 * 60 + 59)),
    ).toBe(true);
    expect(
      isBeforeCustomerDeadline(shoot, kstInstant('2026-10-27', 18 * 60)),
    ).toBe(false);
  });

  it('월요일 촬영의 마감은 일요일 18:00', () => {
    const monday = kstInstant('2026-11-02', 10 * 60);
    expect(customerDeadline(monday).toISOString()).toBe(
      kstInstant('2026-11-01', 18 * 60).toISOString(),
    );
  });
});

describe('완료·노쇼 표시 (R8)', () => {
  it('촬영 시작 전에는 안 되고 시작 후에는 된다', () => {
    const start = kstInstant('2026-10-27', 15 * 60);
    expect(canMarkResult(start, now)).toBe(false);
    expect(canMarkResult(start, kstInstant('2026-10-27', 15 * 60))).toBe(true);
  });
});

describe('시간 겹침 (R1)', () => {
  const range = (from: string, to: string) => ({
    start: kstInstant('2026-10-28', at(from)),
    end: kstInstant('2026-10-28', at(to)),
  });

  it('맞닿은 시간은 겹치지 않는다', () => {
    expect(overlaps(range('10:00', '11:00'), range('11:00', '11:30'))).toBe(
      false,
    );
  });

  it('조금이라도 겹치면 겹친다', () => {
    expect(overlaps(range('10:00', '11:00'), range('10:30', '11:00'))).toBe(
      true,
    );
  });
});
