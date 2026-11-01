import { IPasswordHasher } from '../../../src/application/user/ports/IPasswordHasher';
import { PasswordHash } from '../../../src/domain/common/PasswordHash';

export class FakePasswordHasher implements IPasswordHasher {
  async hash(plainText: string): Promise<PasswordHash> {
    return PasswordHash.fromHash(`hashed:${plainText}`);
  }

  async verify(hash: PasswordHash, plainText: string): Promise<boolean> {
    return hash.value === `hashed:${plainText}`;
  }
}