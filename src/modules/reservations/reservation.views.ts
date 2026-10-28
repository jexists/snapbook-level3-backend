// API 응답 모양. 손님 응답에는 연락처·예약 경로·노쇼 기록을 넣지 않는다 (R12).
import { toKstIso } from '../../common/time/kst.js';
import type { AiNote } from '../ai-notes/ai-note.entity.js';
import {
  customerDeadline,
  isBeforeCustomerDeadline,
} from './reservation-rules.js';
import type { Reservation } from './reservation.entity.js';

export interface ShootTypeSummary {
  id: number;
  name: string;
  durationMin: number;
}

export interface CustomerReservationView {
  id: number;
  shootType: ShootTypeSummary;
  startAt: string;
  endAt: string;
  headcount: number;
  purpose: string | null;
  specialRequest: string | null;
  price: number;
  status: Reservation['status'];
  deadline: string;
  canModify: boolean;
}

export interface AiNoteView {
  status: AiNote['status'];
  content: AiNote['content'];
  oneLine: string | null;
  generatedAt: string;
}

export interface AdminReservationView extends Omit<
  CustomerReservationView,
  'canModify'
> {
  customer: { id: number; name: string; phone: string; hasAccount: boolean };
  channel: Reservation['channel'];
  noShowCount: number;
  aiNote: AiNoteView | null;
  changedFromId: number | null;
  createdAt: string;
}

function baseView(reservation: Reservation) {
  return {
    id: reservation.id,
    shootType: {
      id: reservation.shootType.id,
      name: reservation.shootType.name,
      durationMin: reservation.shootType.durationMin,
    },
    startAt: toKstIso(reservation.startAt),
    endAt: toKstIso(reservation.endAt),
    headcount: reservation.headcount,
    purpose: reservation.purpose,
    specialRequest: reservation.specialRequest,
    price: reservation.priceAtBooking,
    status: reservation.status,
    deadline: toKstIso(customerDeadline(reservation.startAt)),
  };
}

export function toCustomerView(
  reservation: Reservation,
  now = new Date(),
): CustomerReservationView {
  return {
    ...baseView(reservation),
    canModify:
      reservation.status === 'confirmed' &&
      isBeforeCustomerDeadline(reservation.startAt, now),
  };
}

export function toAiNoteView(
  note: AiNote | null | undefined,
): AiNoteView | null {
  if (!note) return null;
  return {
    status: note.status,
    content: note.content,
    oneLine: note.oneLine,
    generatedAt: toKstIso(note.generatedAt),
  };
}

export function toAdminView(
  reservation: Reservation,
  noShowCount: number,
): AdminReservationView {
  return {
    ...baseView(reservation),
    customer: {
      id: reservation.customer.id,
      name: reservation.customer.name,
      phone: reservation.customer.phone,
      hasAccount: Boolean(reservation.customer.loginId),
    },
    channel: reservation.channel,
    noShowCount,
    aiNote: toAiNoteView(reservation.aiNote),
    changedFromId: reservation.changedFromId,
    createdAt: toKstIso(reservation.createdAt),
  };
}
