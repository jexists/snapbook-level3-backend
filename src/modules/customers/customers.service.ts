import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { EntityManager, Repository } from 'typeorm';
import { Customer } from './customer.entity.js';

@Injectable()
export class CustomersService {
  constructor(
    @InjectRepository(Customer)
    private readonly customers: Repository<Customer>,
  ) {}

  findById(id: number) {
    return this.customers.findOneBy({ id });
  }

  findByPhone(phone: string) {
    return this.customers.findOneBy({ phone });
  }

  /** 로그인 확인용: 비밀번호 해시까지 함께 가져온다 */
  findWithPasswordByLoginId(loginId: string) {
    return this.customers
      .createQueryBuilder('customer')
      .addSelect('customer.passwordHash')
      .where('customer.loginId = :loginId', { loginId })
      .getOne();
  }

  save(customer: Customer) {
    return this.customers.save(customer);
  }

  create(fields: Partial<Customer>) {
    return this.customers.create(fields);
  }

  /** 관리자 예약용: 같은 번호의 손님이 있으면 그 손님, 없으면 계정 없는 손님을 만든다 */
  async findOrCreateByPhone(
    manager: EntityManager,
    name: string,
    phone: string,
  ) {
    const repository = manager.getRepository(Customer);
    const existing = await repository.findOneBy({ phone });
    if (existing) return existing;
    return repository.save(
      repository.create({ name, phone, loginId: null, passwordHash: null }),
    );
  }
}
