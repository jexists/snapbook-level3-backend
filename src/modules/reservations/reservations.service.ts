import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import {
  DataSource,
  EntityManager,
  In,
  LessThan,
  MoreThan,
  Not,
  Repository,
} from 'typeorm';
import type { AuthUser, Role } from '../../common/auth.types.js';
import { AiNotesService } from '../ai-notes/ai-notes.service.js';
import { hasRequestText } from '../ai-notes/ai-note-prompt.js';
import { CustomersService } from '../customers/customers.service.js';
import { ShootTypesService } from '../shoot-types/shoot-types.service.js';
import {
  AdminCreateReservationDto,
  ChangeReservationDto,
  CreateReservationDto,
  type MyFilter,
  ReservationDetailsDto,
  SlotDto,
} from './reservation.dto.js';
import {
  CANCELLED_STATUSES,
  type ReservationChannel,
} from './reservation.constants.js';
import {
  checkSlot,
  isBeforeCustomerDeadline,
  RULE_MESSAGES,
  slotRange,
} from './reservation-rules.js';
import { Reservation } from './reservation.entity.js';
import { toCustomerView } from './reservation.views.js';

const MSG = {
  notFound: '예약을 찾을 수 없어요.',
  forbidden: '볼 수 있는 권한이 없어요.',
  booked: '이미 예약된 시간이에요. 다른 시간을 골라 주세요.',
  notActive: '이미 취소됐거나 끝난 예약이에요.',
  deadline: '취소·변경 가능 시간이 지났어요. 사진관으로 전화해 주세요.',
  changeFailed: '새 시간으로 바꾸지 못했어요. 기존 예약은 그대로예요.',
} as const;

interface BookingInput {
  customerId: number;
  details: ReservationDetailsDto;
  role: Role;
  channel: ReservationChannel;
  termsAgreedAt: Date | null;
  changedFromId?: number;
}

/** 예약을 만들고 바꾸고 취소하는 일 (손님·관리자 공통) */
@Injectable()
export class ReservationsService {
  constructor(
    private readonly dataSource: DataSource,
    private readonly shootTypes: ShootTypesService,
    private readonly customers: CustomersService,
    private readonly aiNotes: AiNotesService,
    @InjectRepository(Reservation)
    private readonly reservations: Repository<Reservation>,
  ) {}

  async createByCustomer(user: AuthUser, dto: CreateReservationDto) {
    const saved = await this.dataSource.transaction((manager) =>
      this.book(manager, {
        customerId: user.id,
        details: dto,
        role: 'customer',
        channel: 'online',
        termsAgreedAt: new Date(),
      }),
    );
    this.requestAiNote(saved);
    return toCustomerView(await this.load(saved.id));
  }

  async createByAdmin(dto: AdminCreateReservationDto) {
    const saved = await this.dataSource.transaction(async (manager) => {
      const customer = await this.customers.findOrCreateByPhone(
        manager,
        dto.name,
        dto.phone,
      );
      return this.book(manager, {
        customerId: customer.id,
        details: dto,
        role: 'admin',
        channel: dto.channel ?? 'phone',
        termsAgreedAt: null,
      });
    });
    this.requestAiNote(saved);
    return saved.id;
  }

  async listMine(user: AuthUser, filter: MyFilter = 'upcoming') {
    const now = new Date();
    const where = {
      upcoming: { status: 'confirmed' as const, startAt: MoreThan(now) },
      past: {
        status: In(['confirmed', 'completed', 'no_show']),
        startAt: LessThan(now),
      },
      cancelled: { status: In(CANCELLED_STATUSES) },
    }[filter];
    const rows = await this.reservations.find({
      where: { customerId: user.id, ...where },
      relations: { shootType: true },
      order: { startAt: filter === 'upcoming' ? 'ASC' : 'DESC' },
    });
    return rows.map((row) => toCustomerView(row, now));
  }

  async getMine(user: AuthUser, id: number) {
    return toCustomerView(await this.loadOwned(user, id));
  }

  /** 손님은 본인 것만, 전날 18:00까지 (R3, R7). 관리자는 언제든. */
  async cancel(actor: AuthUser, id: number) {
    const reservation =
      actor.role === 'admin'
        ? await this.load(id)
        : await this.loadOwned(actor, id);
    this.assertModifiable(reservation, actor.role);
    reservation.status =
      actor.role === 'admin' ? 'cancelled_by_admin' : 'cancelled_by_customer';
    reservation.cancelledAt = new Date();
    await this.reservations.save(reservation);
    return { id: reservation.id, status: reservation.status };
  }

  /**
   * 예약 변경 (R5): 기존 예약을 changed로 바꾼 뒤 새 예약을 저장한다.
   * 새 시간이 겹치거나 규칙에 맞지 않으면 트랜잭션 전체가 취소되어 기존 예약이 그대로 남는다.
   */
  async change(actor: AuthUser, id: number, dto: ChangeReservationDto) {
    const saved = await this.dataSource
      .transaction(async (manager) => {
        const old = await manager.findOne(Reservation, {
          where: { id },
          lock: { mode: 'pessimistic_write' },
        });
        if (!old) throw new NotFoundException(MSG.notFound);
        if (actor.role === 'customer' && old.customerId !== actor.id) {
          throw new ForbiddenException(MSG.forbidden);
        }
        this.assertModifiable(old, actor.role);

        old.status = 'changed';
        old.cancelledAt = new Date();
        await manager.save(old);

        return this.book(manager, {
          customerId: old.customerId,
          details: {
            shootTypeId: dto.shootTypeId,
            date: dto.date,
            time: dto.time,
            headcount: old.headcount,
            purpose: old.purpose ?? undefined,
            specialRequest: old.specialRequest ?? undefined,
          },
          role: actor.role,
          channel: old.channel,
          termsAgreedAt: old.termsAgreedAt,
          changedFromId: old.id,
        });
      })
      .catch((error: unknown) => {
        if (
          error instanceof BadRequestException ||
          error instanceof ConflictException
        ) {
          const reason = (error.getResponse() as { message?: string }).message;
          throw new ConflictException(
            `${MSG.changeFailed} ${reason ?? ''}`.trim(),
          );
        }
        throw error;
      });

    await this.aiNotes.copyOrRequest(id, saved.id);
    return actor.role === 'admin'
      ? { id: saved.id }
      : toCustomerView(await this.load(saved.id));
  }

  /** 규칙 확인 후 예약 저장. 겹침은 DB 제약(reservations_no_overlap)이 최종으로 막는다. */
  private async book(manager: EntityManager, input: BookingInput) {
    const shootType = await this.shootTypes.getBookable(
      input.details.shootTypeId,
    );
    const slot = toSlot(input.details, shootType.durationMin);
    const violation = checkSlot(slot, input.role, new Date());
    if (violation) throw new BadRequestException(RULE_MESSAGES[violation]);

    const range = slotRange(slot);
    const conflict = await manager.existsBy(Reservation, {
      status: 'confirmed',
      startAt: LessThan(range.end),
      endAt: MoreThan(range.start),
      ...(input.changedFromId ? { id: Not(input.changedFromId) } : {}),
    });
    if (conflict) throw new ConflictException(MSG.booked);

    const repository = manager.getRepository(Reservation);
    return repository.save(
      repository.create({
        customerId: input.customerId,
        shootTypeId: shootType.id,
        startAt: range.start,
        endAt: range.end,
        headcount: input.details.headcount,
        purpose: input.details.purpose?.trim() || null,
        specialRequest: input.details.specialRequest?.trim() || null,
        channel: input.channel,
        termsAgreedAt: input.termsAgreedAt,
        priceAtBooking: shootType.price,
        status: 'confirmed',
        changedFromId: input.changedFromId ?? null,
      }),
    );
  }

  private assertModifiable(reservation: Reservation, role: Role) {
    if (reservation.status !== 'confirmed')
      throw new BadRequestException(MSG.notActive);
    if (
      role === 'customer' &&
      !isBeforeCustomerDeadline(reservation.startAt, new Date())
    ) {
      throw new BadRequestException(MSG.deadline);
    }
  }

  private requestAiNote(reservation: Reservation) {
    if (hasRequestText(reservation)) this.aiNotes.requestFor(reservation.id);
  }

  private async load(id: number) {
    const reservation = await this.reservations.findOne({
      where: { id },
      relations: { shootType: true },
    });
    if (!reservation) throw new NotFoundException(MSG.notFound);
    return reservation;
  }

  private async loadOwned(user: AuthUser, id: number) {
    const reservation = await this.load(id);
    if (reservation.customerId !== user.id)
      throw new ForbiddenException(MSG.forbidden);
    return reservation;
  }
}

function toSlot(slot: SlotDto, durationMinutes: number) {
  const [hours, minutes] = slot.time.split(':').map(Number);
  return {
    date: slot.date,
    startMinutes: hours * 60 + minutes,
    durationMinutes,
  };
}
