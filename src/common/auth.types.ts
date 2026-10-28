export type Role = 'customer' | 'admin';

/** 로그인 토큰에 담기는 정보 */
export interface AuthUser {
  id: number;
  role: Role;
  name: string;
}

export const ROLES_KEY = 'roles';
