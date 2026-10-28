export const RESERVATION_STATUSES = [
  'confirmed',
  'cancelled_by_customer',
  'cancelled_by_admin',
  'changed',
  'completed',
  'no_show',
] as const;
export type ReservationStatus = (typeof RESERVATION_STATUSES)[number];

/** 취소 통계에 들어가는 상태 (R9: 변경으로 생긴 자동 취소는 뺀다) */
export const CANCELLED_STATUSES: ReservationStatus[] = [
  'cancelled_by_customer',
  'cancelled_by_admin',
];

export const RESERVATION_CHANNELS = [
  'online',
  'phone',
  'visit',
  'instagram',
  'other',
] as const;
export type ReservationChannel = (typeof RESERVATION_CHANNELS)[number];
