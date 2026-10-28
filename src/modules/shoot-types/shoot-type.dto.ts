import { PartialType } from '@nestjs/mapped-types';
import {
  IsBoolean,
  IsIn,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  MaxLength,
  Min,
} from 'class-validator';

export const DURATION_OPTIONS = [30, 60, 90, 120];

export class CreateShootTypeDto {
  @IsString({ message: '촬영 종류 이름을 적어 주세요.' })
  @IsNotEmpty({ message: '촬영 종류 이름을 적어 주세요.' })
  @MaxLength(30, { message: '이름은 30자까지 적을 수 있어요.' })
  name: string;

  @IsOptional()
  @IsString()
  @MaxLength(200, { message: '설명은 200자까지 적을 수 있어요.' })
  description?: string;

  @IsIn(DURATION_OPTIONS, {
    message: '촬영 시간은 30분, 60분, 90분, 120분 중에서 골라 주세요.',
  })
  durationMin: number;

  @IsInt({ message: '가격은 숫자로 적어 주세요.' })
  @Min(0, { message: '가격은 0원 이상으로 적어 주세요.' })
  price: number;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}

export class UpdateShootTypeDto extends PartialType(CreateShootTypeDto) {}
