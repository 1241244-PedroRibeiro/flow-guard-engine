import { randomUUID } from 'node:crypto';
import { DomainInvariantException } from '../common/exceptions';
import { TelemetryValue } from '../common/TelemetryValue';

/**
 * ThresholdRule — Entity owned por SensorNode (KB §10.1, DDD §3.2).
 * Invariantes (dupla defesa com chk_threshold_rules_bounds):
 *  - criticalLimit > warningLimit
 *  - 3 <= windowSizeSamples <= 128
 *  - unit consistente entre warning e critical
 */
export class ThresholdRule {
    static readonly MIN_WINDOW_SIZE = 3;
    static readonly MAX_WINDOW_SIZE = 128;
    static readonly DEFAULT_WINDOW_SIZE = 32;

    private constructor(
        private readonly id: string,
        private readonly sensorId: string,
        private readonly warningLimit: TelemetryValue,
        private readonly criticalLimit: TelemetryValue,
        private readonly windowSizeSamples: number,
        private readonly version: number,
    ) {}

    static create(
        sensorId: string,
        warningLimit: TelemetryValue,
        criticalLimit: TelemetryValue,
        windowSizeSamples: number = ThresholdRule.DEFAULT_WINDOW_SIZE,
    ): ThresholdRule {
        ThresholdRule.assertInvariants(warningLimit, criticalLimit, windowSizeSamples);
        return new ThresholdRule(
            randomUUID(),
            sensorId,
            warningLimit,
            criticalLimit,
            windowSizeSamples,
            1,
        );
    }

    static reconstitute(
        id: string,
        sensorId: string,
        warningLimit: TelemetryValue,
        criticalLimit: TelemetryValue,
        windowSizeSamples: number,
        version: number,
    ): ThresholdRule {
        return new ThresholdRule(id, sensorId, warningLimit, criticalLimit, windowSizeSamples, version);
    }

    updateLimits(
        warningLimit: TelemetryValue,
        criticalLimit: TelemetryValue,
        windowSizeSamples: number = this.windowSizeSamples,
    ): ThresholdRule {
        ThresholdRule.assertInvariants(warningLimit, criticalLimit, windowSizeSamples);
        return new ThresholdRule(
            this.id,
            this.sensorId,
            warningLimit,
            criticalLimit,
            windowSizeSamples,
            this.version + 1,
        );
    }

    private static assertInvariants(
        warningLimit: TelemetryValue,
        criticalLimit: TelemetryValue,
        windowSizeSamples: number,
    ): void {
        if (criticalLimit.getUnit() !== warningLimit.getUnit()) {
            throw new DomainInvariantException(
                `warningLimit unit ('${warningLimit.getUnit()}') and criticalLimit unit ('${criticalLimit.getUnit()}') must match.`,
            );
        }
        if (criticalLimit.getNumericValue() <= warningLimit.getNumericValue()) {
            throw new DomainInvariantException(
                `criticalLimit (${criticalLimit.getNumericValue()}) must be strictly greater than warningLimit (${warningLimit.getNumericValue()}).`,
            );
        }
        if (
            !Number.isInteger(windowSizeSamples) ||
            windowSizeSamples < ThresholdRule.MIN_WINDOW_SIZE ||
            windowSizeSamples > ThresholdRule.MAX_WINDOW_SIZE
        ) {
            throw new DomainInvariantException(
                `windowSizeSamples must be an integer between ${ThresholdRule.MIN_WINDOW_SIZE} and ${ThresholdRule.MAX_WINDOW_SIZE}.`,
            );
        }
    }

    getId(): string { return this.id; }
    getSensorId(): string { return this.sensorId; }
    getWarningLimit(): TelemetryValue { return this.warningLimit; }
    getCriticalLimit(): TelemetryValue { return this.criticalLimit; }
    getWindowSizeSamples(): number { return this.windowSizeSamples; }
    getVersion(): number { return this.version; }
}