import { PasswordHash } from '../../../domain/common/PasswordHash';

export interface IPasswordHasher {
  hash(plainText: string): Promise<PasswordHash>;
  verify(hash: PasswordHash, plainText: string): Promise<boolean>;
}