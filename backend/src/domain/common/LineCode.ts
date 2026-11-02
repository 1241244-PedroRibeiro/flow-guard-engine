import { DomainError } from './exceptions/DomainError';

export class LineCode {
  private constructor(private readonly _value: string) {}

  static create(raw: string): LineCode {
    if (typeof raw !== 'string') {
      throw new DomainError('LineCode must be a string');
    }
    const trimmed = raw.trim().toUpperCase();
    if (trimmed.length < 2 || trimmed.length > 30) {
      throw new DomainError('LineCode must be between 2 and 30 characters');
    }
    return new LineCode(trimmed);
  }

  get value(): string {
    return this._value;
  }
}