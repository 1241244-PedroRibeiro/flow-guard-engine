import * as argon2 from 'argon2';
import { IPasswordHasher } from '../../application/user/ports/IPasswordHasher';
import { PasswordHash } from '../../domain/common/PasswordHash';

export class Argon2Hasher implements IPasswordHasher {
  private readonly options: argon2.Options = {
    type: argon2.argon2id,
    memoryCost: 65536, // 64 MiB
    timeCost: 3,
    parallelism: 1,
  };

  async hash(plainText: string): Promise<PasswordHash> {
    const hash = await argon2.hash(plainText, this.options);
    return PasswordHash.fromHash(hash);
  }

  async verify(hash: PasswordHash, plainText: string): Promise<boolean> {
    try {
      return await argon2.verify(hash.value, plainText);
    } catch {
      return false;
    }
  }
}