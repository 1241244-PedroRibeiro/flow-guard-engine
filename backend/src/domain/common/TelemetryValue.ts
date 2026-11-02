import { DomainInvariantException } from './exceptions';

/**
 * TelemetryValue — VO imutável (numericValue + unit). KB §10.1.
 */
export class TelemetryValue {
    private static readonly MAX_UNIT_LENGTH = 20;

    private constructor(
        private readonly numericValue: number,
        private readonly unit: string,
    ) {}

    static create(numericValue: number, unit: string): TelemetryValue {
        if (!Number.isFinite(numericValue)) {
            throw new DomainInvariantException('TelemetryValue numericValue must be a finite number.');
        }
        if (!unit || unit.trim().length === 0) {
            throw new DomainInvariantException('TelemetryValue unit cannot be empty.');
        }
        if (unit.trim().length > TelemetryValue.MAX_UNIT_LENGTH) {
            throw new DomainInvariantException(
                `TelemetryValue unit must be at most ${TelemetryValue.MAX_UNIT_LENGTH} characters.`,
            );
        }
        return new TelemetryValue(numericValue, unit.trim());
    }

    getNumericValue(): number { return this.numericValue; }
    getUnit(): string { return this.unit; }

    equals(other: TelemetryValue): boolean {
        return this.numericValue === other.numericValue && this.unit === other.unit;
    }

    toString(): string { return `${this.numericValue} ${this.unit}`; }
}