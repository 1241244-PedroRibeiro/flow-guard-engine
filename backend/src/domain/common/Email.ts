import { DomainError } from './exceptions/DomainError';

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const MAX_LENGTH = 255;

export class Email {
  private constructor(private readonly _value: string) {}

  static create(raw: string): Email {
    if (typeof raw !== 'string') {
      throw new DomainError('Email must be a string');
    }
    const trimmed = raw.trim().toLowerCase();
    if (trimmed.length === 0) {
      throw new DomainError('Email must not be empty');
    }
    if (trimmed.length > MAX_LENGTH) {
      throw new DomainError(`Email must not exceed ${MAX_LENGTH} characters`);
    }
    if (!EMAIL_REGEX.test(trimmed)) {
      throw new DomainError(`Invalid email format: ${trimmed}`);
    }
    return new Email(trimmed);
  }

  get value(): string {
    return this._value;
  }

  equals(other: Email): boolean {
    return other instanceof Email && this._value === other._value;
  }

  toString(): string {
    return this._value;
  }
}