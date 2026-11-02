import { DomainError } from './exceptions/DomainError';

export class Designation {
  private constructor(private readonly _value: string) {}

  static create(raw: string, maxLength: number = 150): Designation {
    if (typeof raw !== 'string') {
      throw new DomainError('Designation must be a string');
    }
    const trimmed = raw.trim();
    if (trimmed.length < 2) {
      throw new DomainError('Designation must have at least 2 characters');
    }
    if (trimmed.length > maxLength) {
      throw new DomainError(`Designation must not exceed ${maxLength} characters`);
    }
    return new Designation(trimmed);
  }

  get value(): string {
    return this._value;
  }
}