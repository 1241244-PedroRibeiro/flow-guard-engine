import { DomainInvariantException } from './exceptions';

/**
 * SensorSerialNumber — VO do Shared Kernel (KB §10.1).
 * Normaliza para UPPER + TRIM. Invariantes: 3–40 chars, [A-Z0-9-].
 */
export class SensorSerialNumber {
    private static readonly MIN_LENGTH = 3;
    private static readonly MAX_LENGTH = 40;
    private static readonly PATTERN = /^[A-Z0-9-]+$/;

    private constructor(private readonly value: string) {}

    static create(raw: string): SensorSerialNumber {
        if (raw === null || raw === undefined) {
            throw new DomainInvariantException('SensorSerialNumber cannot be null or undefined.');
        }
        const normalized = raw.trim().toUpperCase();
        if (normalized.length < SensorSerialNumber.MIN_LENGTH) {
            throw new DomainInvariantException(
                `SensorSerialNumber must have at least ${SensorSerialNumber.MIN_LENGTH} characters.`,
            );
        }
        if (normalized.length > SensorSerialNumber.MAX_LENGTH) {
            throw new DomainInvariantException(
                `SensorSerialNumber must have at most ${SensorSerialNumber.MAX_LENGTH} characters.`,
            );
        }
        if (!SensorSerialNumber.PATTERN.test(normalized)) {
            throw new DomainInvariantException(
                'SensorSerialNumber must contain only uppercase letters, digits, and hyphens.',
            );
        }
        return new SensorSerialNumber(normalized);
    }

    getValue(): string { return this.value; }

    equals(other: SensorSerialNumber): boolean {
        return this.value === other.value;
    }

    toString(): string { return this.value; }
}