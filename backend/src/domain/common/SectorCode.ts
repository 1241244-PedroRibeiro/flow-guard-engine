import { DomainError } from './exceptions/DomainError';

export class SectorCode {
  private constructor(private readonly _value: string) {}

  static create(raw: string): SectorCode {
    if (typeof raw !== 'string') {
      throw new DomainError('SectorCode must be a string');
    }
    const trimmed = raw.trim().toUpperCase();
    if (trimmed.length < 2 || trimmed.length > 30) {
      throw new DomainError('SectorCode must be between 2 and 30 characters');
    }
    return new SectorCode(trimmed);
  }

  get value(): string {
    return this._value;
  }
}