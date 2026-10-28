// 여러 DTO에서 같이 쓰는 입력 규칙과 안내 문구 (R10)
export const PHONE_PATTERN = /^010\d{8}$/;
export const LOGIN_ID_PATTERN = /^[A-Za-z0-9]{4,20}$/;
export const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;
export const TIME_PATTERN = /^([01]\d|2[0-3]):[0-5]\d$/;

export const MSG = {
  nameRequired: '이름을 적어 주세요.',
  nameTooLong: '이름은 20자까지 적을 수 있어요.',
  phone: '휴대폰 번호는 010으로 시작하는 11자리 숫자로 적어 주세요.',
  loginId: '아이디는 영문과 숫자로 4~20자로 적어 주세요.',
  password: '비밀번호는 8자 이상으로 적어 주세요.',
  date: '날짜를 골라 주세요.',
  time: '시간을 골라 주세요.',
  headcount: '촬영 인원은 1명부터 10명까지 적어 주세요.',
  purposeTooLong: '사용 목적은 30자까지 적을 수 있어요.',
  requestTooLong: '특별 요청사항은 300자까지 적을 수 있어요.',
  shootType: '촬영 종류를 골라 주세요.',
} as const;
