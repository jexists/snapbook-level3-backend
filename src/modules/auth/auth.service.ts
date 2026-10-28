import {
  ConflictException,
  Injectable,
  Logger,
  OnApplicationBootstrap,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { InjectRepository } from '@nestjs/typeorm';
import bcrypt from 'bcryptjs';
import { Repository } from 'typeorm';
import type { AuthUser } from '../../common/auth.types.js';
import type { AppEnv } from '../../config/env.js';
import { CustomersService } from '../customers/customers.service.js';
import { Admin } from './admin.entity.js';
import { LoginDto, SignupDto } from './auth.dto.js';

const LOGIN_FAILED = '아이디 또는 비밀번호가 맞지 않아요.';

export interface LoginResult {
  token: string;
  user: AuthUser;
}

@Injectable()
export class AuthService implements OnApplicationBootstrap {
  private readonly logger = new Logger(AuthService.name);

  constructor(
    private readonly customers: CustomersService,
    private readonly jwt: JwtService,
    private readonly config: ConfigService<AppEnv, true>,
    @InjectRepository(Admin) private readonly admins: Repository<Admin>,
  ) {}

  /** 서버를 처음 켤 때 .env의 관리자 계정이 없으면 만든다 */
  async onApplicationBootstrap() {
    const loginId = this.config.get('ADMIN_LOGIN_ID', { infer: true });
    if (await this.admins.existsBy({ loginId })) return;
    const passwordHash = await bcrypt.hash(
      this.config.get('ADMIN_PASSWORD', { infer: true }),
      10,
    );
    await this.admins.save(
      this.admins.create({ loginId, passwordHash, name: '관리자' }),
    );
    this.logger.log(`관리자 계정(${loginId})을 만들었어요`);
  }

  /** 같은 번호로 관리자가 먼저 넣은 손님 기록이 있으면 거기에 계정을 붙인다 */
  async signup(dto: SignupDto): Promise<LoginResult> {
    const passwordHash = await bcrypt.hash(dto.password, 10);
    // 로그인 화면이 하나라 관리자 아이디와 겹치는 손님 아이디는 받지 않는다
    if (await this.admins.existsBy({ loginId: dto.loginId }))
      throw new ConflictException('이미 쓰는 아이디예요.');
    const existing = await this.customers.findByPhone(dto.phone);
    if (existing?.loginId)
      throw new ConflictException('이미 가입된 휴대폰 번호예요.');

    const customer = existing ?? this.customers.create({ phone: dto.phone });
    customer.name = dto.name;
    customer.loginId = dto.loginId;
    customer.passwordHash = passwordHash;
    const saved = await this.customers.save(customer);
    return this.issue({ id: saved.id, role: 'customer', name: saved.name });
  }

  /** 손님과 관리자가 같은 로그인 화면을 쓴다. 손님 계정이 아니면 관리자 계정을 확인한다. */
  async login(dto: LoginDto): Promise<LoginResult> {
    const customer = await this.customers.findWithPasswordByLoginId(
      dto.loginId,
    );
    if (
      customer?.passwordHash &&
      (await bcrypt.compare(dto.password, customer.passwordHash))
    ) {
      return this.issue({
        id: customer.id,
        role: 'customer',
        name: customer.name,
      });
    }
    return this.adminLogin(dto);
  }

  async adminLogin(dto: LoginDto): Promise<LoginResult> {
    const admin = await this.admins
      .createQueryBuilder('admin')
      .addSelect('admin.passwordHash')
      .where('admin.loginId = :loginId', { loginId: dto.loginId })
      .getOne();
    if (!admin || !(await bcrypt.compare(dto.password, admin.passwordHash))) {
      throw new UnauthorizedException(LOGIN_FAILED);
    }
    return this.issue({ id: admin.id, role: 'admin', name: admin.name });
  }

  private async issue(user: AuthUser): Promise<LoginResult> {
    return { token: await this.jwt.signAsync({ ...user }), user };
  }
}
