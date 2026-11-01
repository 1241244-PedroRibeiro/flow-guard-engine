import { ITokenService, TokenPayload } from '../../../src/application/user/ports/ITokenService';

export class FakeTokenService implements ITokenService {
  sign(payload: TokenPayload): string {
    return `fake-token-${payload.sub}`;
  }

  verify(token: string): TokenPayload {
    if (!token.startsWith('fake-token-')) {
      throw new Error('Invalid token');
    }
    return { sub: token.replace('fake-token-', ''), email: 'test@test.com', roles: [] };
  }
}