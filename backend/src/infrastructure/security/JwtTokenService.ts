import * as jwt from 'jsonwebtoken';
import { ITokenService, TokenPayload } from '../../application/user/ports/ITokenService';

export class JwtTokenService implements ITokenService {
  private readonly secret: string;
  private readonly expiresIn = 28800; // 8 horas

  constructor() {
    this.secret = process.env.JWT_SECRET || 'fallback-secret-do-not-use-in-prod';
  }

  sign(payload: TokenPayload): string {
    return jwt.sign(payload, this.secret, { expiresIn: this.expiresIn });
  }

  verify(token: string): TokenPayload {
    return jwt.verify(token, this.secret) as TokenPayload;
  }
}