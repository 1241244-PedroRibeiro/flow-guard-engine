import { UserRole } from '../../../domain/user/UserRole';

export interface TokenPayload {
  sub: string;
  email: string;
  roles: UserRole[];
}

export interface ITokenService {
  sign(payload: TokenPayload): string;
  verify(token: string): TokenPayload;
}