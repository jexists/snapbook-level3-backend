import {
  IsNotEmpty,
  IsString,
  Matches,
  MaxLength,
  MinLength,
} from 'class-validator';
import {
  LOGIN_ID_PATTERN,
  MSG,
  PHONE_PATTERN,
} from '../../common/dto/validation-messages.js';

export class SignupDto {
  @IsString({ message: MSG.nameRequired })
  @IsNotEmpty({ message: MSG.nameRequired })
  @MaxLength(20, { message: MSG.nameTooLong })
  name: string;

  @Matches(PHONE_PATTERN, { message: MSG.phone })
  phone: string;

  @Matches(LOGIN_ID_PATTERN, { message: MSG.loginId })
  loginId: string;

  @IsString({ message: MSG.password })
  @MinLength(8, { message: MSG.password })
  @MaxLength(72, { message: '비밀번호는 72자까지 적을 수 있어요.' })
  password: string;
}

export class LoginDto {
  @IsString({ message: '아이디를 적어 주세요.' })
  @IsNotEmpty({ message: '아이디를 적어 주세요.' })
  loginId: string;

  @IsString({ message: '비밀번호를 적어 주세요.' })
  @IsNotEmpty({ message: '비밀번호를 적어 주세요.' })
  password: string;
}
