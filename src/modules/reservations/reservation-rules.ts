// 예약 규칙(기획서 7장)을 판단하는 순수 함수 모음. DB나 HTTP를 모른다.
import {
  addDays,
  DateKey,
  kstInstant,
  toKstDateKey,
  toKstMinutes,
  weekdayOf,
} from '../../common/time/kst.js';

export const OPEN_MINUTES = 10 * 60;
export const CLOSE_MINUTES = 18 * 60;
export const LUNCH_START = 12 * 60;
export const LUNCH_END = 13 * 60;
export const SLOT_MINUTES = 30;
export const BOOKING_WINDOW_DAYS = 30;
/** 손님 취소·변경·접수 마감: 촬영 전날 18:00 */
export const CUSTOMER_DEADLINE_MINUTES = 18 * 60;

export const SLOT_STARTS: number[] = Array.from(
  { length: (CLOSE_MINUTES - OPEN_MINUTES) / SLOT_MINUTES },
  (_, index) => OPEN_MINUTES + index * SLOT_MINUTES,
);

export type ActorRole = 'customer' | 'admin';

export type RuleViolation =
  | 'SUNDAY'
  | 'OUTSIDE_HOURS'
  | 'NOT_ON_SLOT'
  | 'LUNCH'
  | 'PAST'
  | 'TOO_FAR'
  | 'SAME_DAY'
  | 'BOOKING_CLOSED';

export const RULE_MESSAGES: Record<RuleViolation, string> = {
  SUNDAY: '일요일은 휴무라 예약할 수 없어요.',
  OUTSIDE_HOURS:
    '이 시간에는 예약할 수 없어요. 영업시간은 월~토 10:00~18:00(점심 12~13시 제외)이에요.',
  NOT_ON_SLOT: '예약 시작 시간은 30분 단위로 골라 주세요.',
  LUNCH: '점심시간(12:00~13:00)과 겹쳐서 예약할 수 없어요.',
  PAST: '이미 지난 시간이에요. 다른 시간을 골라 주세요.',
  TOO_FAR: `예약은 오늘부터 ${BOOKING_WINDOW_DAYS}일 안까지만 할 수 있어요.`,
  SAME_DAY: '당일 예약은 온라인으로 받지 않아요. 내일부터 예약해 주세요.',
  BOOKING_CLOSED: '내일 촬영은 오늘 18:00까지 신청할 수 있어요.',
};

export interface SlotRequest {
  date: DateKey;
  startMinutes: number;
  durationMinutes: number;
}

/** 요일·영업시간·점심·30분 단위 확인 (R2) */
export function checkBusinessHours(slot: SlotRequest): RuleViolation | null {
  const end = slot.startMinutes + slot.durationMinutes;
  if (weekdayOf(slot.date) === 0) return 'SUNDAY';
  if ((slot.startMinutes - OPEN_MINUTES) % SLOT_MINUTES !== 0) {
    return 'NOT_ON_SLOT';
  }
  if (slot.startMinutes < OPEN_MINUTES || end > CLOSE_MINUTES) {
    return 'OUTSIDE_HOURS';
  }
  if (slot.startMinutes < LUNCH_END && end > LUNCH_START) return 'LUNCH';
  return null;
}

/** 역할별 예약 가능 날짜 범위와 손님 접수 마감 확인 (R2, R4) */
export function checkBookingWindow(
  slot: SlotRequest,
  role: ActorRole,
  now: Date,
): RuleViolation | null {
  const today = toKstDateKey(now);
  const start = kstInstant(slot.date, slot.startMinutes);
  if (start.getTime() <= now.getTime()) return 'PAST';
  if (slot.date > addDays(today, BOOKING_WINDOW_DAYS)) return 'TOO_FAR';
  if (role === 'admin') return null;
  if (slot.date === today) return 'SAME_DAY';
  if (!isBeforeCustomerDeadline(start, now)) return 'BOOKING_CLOSED';
  return null;
}

export function checkSlot(
  slot: SlotRequest,
  role: ActorRole,
  now: Date,
): RuleViolation | null {
  return checkBusinessHours(slot) ?? checkBookingWindow(slot, role, now);
}

/** 손님 마감 시각: 촬영 전날 18:00 (R3, R4) */
export function customerDeadline(startAt: Date): Date {
  const shootDate = toKstDateKey(startAt);
  return kstInstant(addDays(shootDate, -1), CUSTOMER_DEADLINE_MINUTES);
}

export function isBeforeCustomerDeadline(startAt: Date, now: Date): boolean {
  return now.getTime() < customerDeadline(startAt).getTime();
}

/** 촬영 완료·노쇼는 시작 시각이 지난 뒤에만 (R8) */
export function canMarkResult(startAt: Date, now: Date): boolean {
  return now.getTime() >= startAt.getTime();
}

export interface TimeRange {
  start: Date;
  end: Date;
}

export function overlaps(a: TimeRange, b: TimeRange): boolean {
  return (
    a.start.getTime() < b.end.getTime() && b.start.getTime() < a.end.getTime()
  );
}

export function slotRange(slot: SlotRequest): TimeRange {
  return {
    start: kstInstant(slot.date, slot.startMinutes),
    end: kstInstant(slot.date, slot.startMinutes + slot.durationMinutes),
  };
}

export function slotFromStart(
  startAt: Date,
  durationMinutes: number,
): SlotRequest {
  return {
    date: toKstDateKey(startAt),
    startMinutes: toKstMinutes(startAt),
    durationMinutes,
  };
}
