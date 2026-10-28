import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { CreateShootTypeDto, UpdateShootTypeDto } from './shoot-type.dto.js';
import { Reservation } from '../reservations/reservation.entity.js';
import { ShootType } from './shoot-type.entity.js';

@Injectable()
export class ShootTypesService {
  constructor(
    @InjectRepository(ShootType)
    private readonly shootTypes: Repository<ShootType>,
  ) {}

  list(includeInactive = false) {
    return this.shootTypes.find({
      where: includeInactive ? {} : { isActive: true },
      order: { id: 'ASC' },
    });
  }

  async get(id: number, includeInactive = false) {
    const shootType = await this.shootTypes.findOneBy({ id });
    if (!shootType || (!includeInactive && !shootType.isActive)) {
      throw new NotFoundException('촬영 종류를 찾을 수 없어요.');
    }
    return shootType;
  }

  /** 예약할 때 쓰는 확인: 판매 중인 종류만 예약할 수 있다 */
  async getBookable(id: number) {
    const shootType = await this.shootTypes.findOneBy({ id });
    if (!shootType?.isActive) {
      throw new BadRequestException('지금은 예약을 받지 않는 촬영 종류예요.');
    }
    return shootType;
  }

  create(dto: CreateShootTypeDto) {
    return this.shootTypes.save(
      this.shootTypes.create({
        name: dto.name,
        description: dto.description ?? null,
        durationMin: dto.durationMin,
        price: dto.price,
        isActive: dto.isActive ?? true,
      }),
    );
  }

  async update(id: number, dto: UpdateShootTypeDto) {
    const shootType = await this.get(id, true);
    return this.shootTypes.save(Object.assign(shootType, dto));
  }

  /** 지난 예약 기록이 이 종류를 가리키므로, 예약이 하나라도 있으면 지우지 않는다 */
  async remove(id: number) {
    const shootType = await this.get(id, true);
    const used = await this.shootTypes.manager.count(Reservation, {
      where: { shootTypeId: id },
    });
    if (used > 0) {
      throw new ConflictException(
        "예약이 있는 촬영 종류는 지울 수 없어요. 대신 '지금 예약받기'를 꺼 주세요.",
      );
    }
    await this.shootTypes.remove(shootType);
    return { id };
  }
}
