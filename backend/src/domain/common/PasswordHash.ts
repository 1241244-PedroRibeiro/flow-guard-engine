import { DomainError } from './exceptions/DomainError';

const MAX_LENGTH = 255;

/**
 * Opaque wrapper for a pre-computed password hash.
 * NEVER stores, hashes, or verifies plaintext — that is the responsibility of
 * the infrastructure `IPasswordHasher` port (Argon2id). This VO only prevents
 * raw `string` values from crossing domain boundaries.
 */
export class PasswordHash {
  private constructor(private readonly _value: string) {}

  static fromHash(raw: string): PasswordHash {
    if (typeof raw !== 'string' || raw.trim().length === 0) {
      throw new DomainError('PasswordHash must not be empty');
    }
    if (raw.length > MAX_LENGTH) {
      throw new DomainError(`PasswordHash must not exceed ${MAX_LENGTH} characters`);
    }
    return new PasswordHash(raw);
  }

  get value(): string {
    return this._value;
  }

  equals(other: PasswordHash): boolean {
    return other instanceof PasswordHash && this._value === other._value;
  }

  /** Redacts the value to prevent accidental logging. */
  toString(): string {
    return '[REDACTED]';
  }
}