import { randomUUID } from 'node:crypto';
import { DomainError } from '../common/exceptions/DomainError';

const UUID_V4_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export class UserId {
  private constructor(private readonly _value: string) {}

  static generate(): UserId {
    return new UserId(randomUUID());
  }

  static create(value: string): UserId {
    if (typeof value !== 'string' || !UUID_V4_REGEX.test(value)) {
      throw new DomainError(`Invalid UserId UUID: ${value}`);
    }
    return new UserId(value);
  }

  get value(): string {
    return this._value;
  }

  equals(other: UserId): boolean {
    return other instanceof UserId && this._value === other._value;
  }

  toString(): string {
    return this._value;
  }
}