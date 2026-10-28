import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository, type SelectQueryBuilder } from 'typeorm';
import type { Paginated } from '../../common/dto/pagination-query.dto.js';
import {
  addDays,
  formatMinutes,
  kstInstant,
  toKstDateKey,
  toKstMinutes,
  type DateKey,
} from '../../common/time/kst.js';
import { DB_SCHEMA } from '../../database/database.constants.js';
import { canMarkResult } from './reservation-rules.js';
import {
  CANCELLED_STATUSES,
  type ReservationStatus,
} from './reservation.constants.js';
import {
  SearchReservationsQueryDto,
  UpdateStatusDto,
} from './reservation.dto.js';
import { Reservation } from './reservation.entity.js';
import { toAdminView, type AdminReservationView } from './reservation.views.js';

/** 달력·현황에 세는 "실제 예약" (취소·변경된 것은 뺀다) */
const ACTIVE_STATUSES: ReservationStatus[] = [
  'confirmed',
  'completed',
  'no_show',
];

export interface DayCount {
  date: DateKey;
  count: number;
}

export interface PrepItem {
  reservationId: number;
  time: string;
  shootType: string;
  headcount: number;
  oneLine: string;
}

export interface DaySchedule {
  date: DateKey;
  isToday: boolean;
  isTomorrow: boolean;
  reservations: AdminReservationView[];
  prep: PrepItem[];
  kakaoPreview: string | null;
}

/** 관리자 화면에서 보는 조회·현황 (기획서 5장 A2, A4, A5) */
@Injectable()
export class ReservationQueriesService {
  constructor(
    @InjectRepository(Reservation)
    private readonly reservations: Repository<Reservation>,
  ) {}

  async month(month: string): Promise<DayCount[]> {
    return this.countByDate(`${month}-01`, nextMonthStart(month));
  }

  async week(start: DateKey): Promise<DayCount[]> {
    return this.countByDate(start, addDays(start, 7));
  }

  async day(date: DateKey, now = new Date()): Promise<DaySchedule> {
    const rows = await this.withRelations()
      .where('reservation.status IN (:...statuses)', {
        statuses: ACTIVE_STATUSES,
      })
      .andWhere('reservation.startAt >= :from AND reservation.startAt < :to', {
        from: kstInstant(date),
        to: kstInstant(addDays(date, 1)),
      })
      .orderBy('reservation.startAt', 'ASC')
      .getMany();

    const reservations = await this.toAdminViews(rows);
    const prep = rows
      .filter((row) => row.aiNote?.status === 'done' && row.aiNote.oneLine)
      .map((row) => ({
        reservationId: row.id,
        time: formatMinutes(toKstMinutes(row.startAt)),
        shootType: row.shootType.name,
        headcount: row.headcount,
        oneLine: row.aiNote?.oneLine ?? '',
      }));

    const today = toKstDateKey(now);
    const isTomorrow = date === addDays(today, 1);
    return {
      date,
      isToday: date === today,
      isTomorrow,
      reservations,
      prep,
      kakaoPreview: isTomorrow ? buildKakaoPreview(rows, prep) : null,
    };
  }

  async search(
    query: SearchReservationsQueryDto,
  ): Promise<Paginated<AdminReservationView>> {
    const builder = this.withRelations().orderBy('reservation.startAt', 'DESC');
    if (query.from)
      builder.andWhere('reservation.startAt >= :from', {
        from: kstInstant(query.from),
      });
    if (query.to) {
      builder.andWhere('reservation.startAt < :to', {
        to: kstInstant(addDays(query.to, 1)),
      });
    }
    if (query.status)
      builder.andWhere('reservation.status = :status', {
        status: query.status,
      });
    if (query.shootTypeId) {
      builder.andWhere('reservation.shootTypeId = :shootTypeId', {
        shootTypeId: query.shootTypeId,
      });
    }
    if (query.channel)
      builder.andWhere('reservation.channel = :channel', {
        channel: query.channel,
      });
    if (query.q?.trim()) {
      builder.andWhere('(customer.name ILIKE :q OR customer.phone LIKE :q)', {
        q: `%${query.q.trim()}%`,
      });
    }

    const [rows, total] = await builder
      .skip((query.page - 1) * query.size)
      .take(query.size)
      .getManyAndCount();
    return {
      items: await this.toAdminViews(rows),
      total,
      page: query.page,
      size: query.size,
    };
  }

  async detail(id: number): Promise<AdminReservationView> {
    const row = await this.withRelations()
      .where('reservation.id = :id', { id })
      .getOne();
    if (!row) throw new NotFoundException('예약을 찾을 수 없어요.');
    const [view] = await this.toAdminViews([row]);
    return view;
  }

  /** 촬영 완료·노쇼 표시 (R8) */
  async updateStatus(id: number, dto: UpdateStatusDto) {
    const reservation = await this.reservations.findOneBy({ id });
    if (!reservation) throw new NotFoundException('예약을 찾을 수 없어요.');
    if (!ACTIVE_STATUSES.includes(reservation.status)) {
      throw new BadRequestException('취소된 예약은 바꿀 수 없어요.');
    }
    if (!canMarkResult(reservation.startAt, new Date())) {
      throw new BadRequestException('아직 촬영 시간이 되지 않았어요.');
    }
    reservation.status = dto.status;
    await this.reservations.save(reservation);
    return this.detail(id);
  }

  /** 현황 숫자 3개 (R9: 변경으로 생긴 자동 취소는 취소에 넣지 않는다) */
  async stats(month: string) {
    const from = kstInstant(`${month}-01`);
    const to = kstInstant(nextMonthStart(month));
    const count = (statuses: ReservationStatus[]) =>
      this.reservations
        .createQueryBuilder('reservation')
        .where('reservation.status IN (:...statuses)', { statuses })
        .andWhere(
          'reservation.startAt >= :from AND reservation.startAt < :to',
          { from, to },
        )
        .getCount();
    const [reservations, cancelled, noShow] = await Promise.all([
      count(ACTIVE_STATUSES),
      count(CANCELLED_STATUSES),
      count(['no_show']),
    ]);
    return { month, reservations, cancelled, noShow };
  }

  private withRelations(): SelectQueryBuilder<Reservation> {
    return this.reservations
      .createQueryBuilder('reservation')
      .innerJoinAndSelect('reservation.customer', 'customer')
      .innerJoinAndSelect('reservation.shootType', 'shootType')
      .leftJoinAndSelect('reservation.aiNote', 'aiNote');
  }

  private async toAdminViews(rows: Reservation[]) {
    const noShows = await this.noShowCounts(rows.map((row) => row.customerId));
    return rows.map((row) =>
      toAdminView(row, noShows.get(row.customerId) ?? 0),
    );
  }

  /** 같은 손님(같은 전화번호)의 과거 노쇼 횟수 */
  private async noShowCounts(customerIds: number[]) {
    const counts = new Map<number, number>();
    if (customerIds.length === 0) return counts;
    const rows = await this.reservations
      .createQueryBuilder('reservation')
      .select('reservation.customerId', 'customerId')
      .addSelect('COUNT(*)::int', 'count')
      .where({ customerId: In([...new Set(customerIds)]), status: 'no_show' })
      .groupBy('reservation.customerId')
      .getRawMany<{ customerId: number; count: number }>();
    rows.forEach((row) => counts.set(row.customerId, row.count));
    return counts;
  }

  private async countByDate(from: DateKey, to: DateKey): Promise<DayCount[]> {
    const rows: { date: string; count: number }[] =
      await this.reservations.query(
        `SELECT to_char(start_at AT TIME ZONE 'Asia/Seoul', 'YYYY-MM-DD') AS date, COUNT(*)::int AS count
         FROM ${DB_SCHEMA}.reservations
        WHERE status = ANY($1) AND start_at >= $2 AND start_at < $3
        GROUP BY 1 ORDER BY 1`,
        [ACTIVE_STATUSES, kstInstant(from), kstInstant(to)],
      );
    return rows;
  }
}

function nextMonthStart(month: string): DateKey {
  const [year, monthNumber] = month.split('-').map(Number);
  const next =
    monthNumber === 12
      ? `${year + 1}-01`
      : `${year}-${String(monthNumber + 1).padStart(2, '0')}`;
  return `${next}-01`;
}

/** 카카오톡 알림 미리보기 문구. 이름·연락처는 넣지 않는다. 실제 전송은 하지 않는다. */
function buildKakaoPreview(rows: Reservation[], prep: PrepItem[]): string {
  if (rows.length === 0) return '[내일 촬영 0건] 내일은 예약이 없어요.';
  const lines = rows.map((row) => {
    const note = prep.find((item) => item.reservationId === row.id);
    const time = formatMinutes(toKstMinutes(row.startAt));
    return `${time} ${row.shootType.name} ${row.headcount}명${note ? ` · ${note.oneLine}` : ''}`;
  });
  return [`[내일 촬영 ${rows.length}건]`, ...lines].join('\n');
}
