import { Type } from 'class-transformer';
import {
  Equals,
  IsIn,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  Matches,
  Max,
  MaxLength,
  Min,
} from 'class-validator';
import { PaginationQueryDto } from '../../common/dto/pagination-query.dto.js';
import {
  DATE_PATTERN,
  MSG,
  PHONE_PATTERN,
  TIME_PATTERN,
} from '../../common/dto/validation-messages.js';
import {
  RESERVATION_CHANNELS,
  RESERVATION_STATUSES,
  type ReservationChannel,
  type ReservationStatus,
} from './reservation.constants.js';

/** 날짜·시간·종류 (예약, 변경, 관리자 예약이 같이 씀) */
export class SlotDto {
  @Type(() => Number)
  @IsInt({ message: MSG.shootType })
  shootTypeId: number;

  @Matches(DATE_PATTERN, { message: MSG.date })
  date: string;

  @Matches(TIME_PATTERN, { message: MSG.time })
  time: string;
}

export class ReservationDetailsDto extends SlotDto {
  @Type(() => Number)
  @IsInt({ message: MSG.headcount })
  @Min(1, { message: MSG.headcount })
  @Max(10, { message: MSG.headcount })
  headcount: number;

  @IsOptional()
  @IsString()
  @MaxLength(30, { message: MSG.purposeTooLong })
  purpose?: string;

  @IsOptional()
  @IsString()
  @MaxLength(300, { message: MSG.requestTooLong })
  specialRequest?: string;
}

export class CreateReservationDto extends ReservationDetailsDto {
  @Equals(true, { message: '이용 안내에 동의해 주세요.' })
  agreeTerms: boolean;
}

export class AdminCreateReservationDto extends ReservationDetailsDto {
  @IsString({ message: MSG.nameRequired })
  @IsNotEmpty({ message: MSG.nameRequired })
  @MaxLength(20, { message: MSG.nameTooLong })
  name: string;

  @Matches(PHONE_PATTERN, { message: MSG.phone })
  phone: string;

  @IsOptional()
  @IsIn(RESERVATION_CHANNELS, { message: '예약 경로를 골라 주세요.' })
  channel?: ReservationChannel;
}

export class ChangeReservationDto extends SlotDto {}

export const MY_FILTERS = ['upcoming', 'past', 'cancelled'] as const;
export type MyFilter = (typeof MY_FILTERS)[number];

export class MyReservationsQueryDto {
  @IsOptional()
  @IsIn(MY_FILTERS)
  filter?: MyFilter;
}

export class WeekQueryDto {
  @Matches(DATE_PATTERN, { message: MSG.date })
  start: string;

  @Type(() => Number)
  @IsInt({ message: MSG.shootType })
  shootTypeId: number;

  /** 예약 변경 중이면 자기 자신의 시간은 비어 있는 것으로 본다 */
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  excludeReservationId?: number;
}

export class DateQueryDto {
  @Matches(DATE_PATTERN, { message: MSG.date })
  date: string;
}

export class MonthQueryDto {
  @Matches(/^\d{4}-\d{2}$/, { message: '월을 골라 주세요.' })
  month: string;
}

export class SearchReservationsQueryDto extends PaginationQueryDto {
  @IsOptional()
  @Matches(DATE_PATTERN, { message: MSG.date })
  from?: string;

  @IsOptional()
  @Matches(DATE_PATTERN, { message: MSG.date })
  to?: string;

  @IsOptional()
  @IsIn(RESERVATION_STATUSES)
  status?: ReservationStatus;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  shootTypeId?: number;

  @IsOptional()
  @IsIn(RESERVATION_CHANNELS)
  channel?: ReservationChannel;

  /** 이름 또는 전화번호 */
  @IsOptional()
  @IsString()
  @MaxLength(20)
  q?: string;
}

export class UpdateStatusDto {
  @IsIn(['completed', 'no_show'], {
    message: '촬영 완료 또는 노쇼만 고를 수 있어요.',
  })
  status: 'completed' | 'no_show';
}
