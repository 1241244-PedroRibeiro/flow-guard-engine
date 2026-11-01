import { DomainError } from './exceptions/DomainError';

const MAX_LENGTH = 75;

export class PersonName {
  private constructor(
    private readonly _firstName: string,
    private readonly _lastName: string,
  ) {}

  static create(firstName: string, lastName: string): PersonName {
    const fn = PersonName.normalize(firstName, 'first name');
    const ln = PersonName.normalize(lastName, 'last name');
    return new PersonName(fn, ln);
  }

  private static normalize(raw: unknown, field: string): string {
    if (typeof raw !== 'string') {
      throw new DomainError(`PersonName ${field} must be a string`);
    }
    const trimmed = raw.trim();
    if (trimmed.length === 0) {
      throw new DomainError(`PersonName ${field} must not be empty`);
    }
    if (trimmed.length > MAX_LENGTH) {
      throw new DomainError(`PersonName ${field} must not exceed ${MAX_LENGTH} characters`);
    }
    return trimmed;
  }

  get firstName(): string {
    return this._firstName;
  }

  get lastName(): string {
    return this._lastName;
  }

  fullName(): string {
    return `${this._firstName} ${this._lastName}`;
  }

  equals(other: PersonName): boolean {
    return (
      other instanceof PersonName &&
      this._firstName === other._firstName &&
      this._lastName === other._lastName
    );
  }
}