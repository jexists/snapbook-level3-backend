export interface AppEnv {
  PORT: number;
  FRONTEND_ORIGIN: string;
  DATABASE_URL: string;
  JWT_SECRET: string;
  ADMIN_LOGIN_ID: string;
  ADMIN_PASSWORD: string;
  GPT_API_KEY: string;
  GPT_MODEL: string;
}

const REQUIRED_KEYS = [
  'DATABASE_URL',
  'JWT_SECRET',
  'ADMIN_LOGIN_ID',
  'ADMIN_PASSWORD',
] as const;

export function validateEnv(raw: Record<string, unknown>): AppEnv {
  const missing = REQUIRED_KEYS.filter((key) => !raw[key]);
  if (missing.length > 0) {
    throw new Error(
      `.env에 필수 값이 없어요: ${missing.join(', ')} (.env.example을 참고하세요)`,
    );
  }
  const text = (key: string, fallback = '') =>
    typeof raw[key] === 'string' ? raw[key] : fallback;

  return {
    PORT: Number(raw.PORT ?? 4100),
    FRONTEND_ORIGIN: text('FRONTEND_ORIGIN', 'http://localhost:3100'),
    DATABASE_URL: text('DATABASE_URL'),
    JWT_SECRET: text('JWT_SECRET'),
    ADMIN_LOGIN_ID: text('ADMIN_LOGIN_ID'),
    ADMIN_PASSWORD: text('ADMIN_PASSWORD'),
    GPT_API_KEY: text('GPT_API_KEY'),
    GPT_MODEL: text('GPT_MODEL', 'gpt-5.4-mini'),
  };
}
