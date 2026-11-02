import { DomainInvariantException } from './exceptions/DomainInvariantException';

export class PartCode {
  private constructor(private readonly code: string) {}

  static create(code: string): PartCode {
    if (!code || code.trim().length < 3 || code.trim().length > 30) {
      throw new DomainInvariantException('PartCode must be between 3 and 30 characters.');
    }
    // Optional: enforce uppercase alphanumeric with hyphens
    const normalized = code.trim().toUpperCase();
    if (!/^[A-Z0-9-]+$/.test(normalized)) {
      throw new DomainInvariantException('PartCode can only contain uppercase letters, numbers, and hyphens.');
    }
    return new PartCode(normalized);
  }

  get value(): string { return this.code; }
}