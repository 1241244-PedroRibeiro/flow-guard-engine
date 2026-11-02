import { DomainInvariantException } from '../../../../src/domain/common/exceptions';
import { TelemetryValue } from '../../../../src/domain/common/TelemetryValue';
import { ThresholdRule } from '../../../../src/domain/sensor/ThresholdRule';

describe('ThresholdRule', () => {
    const make = (w: number, c: number, window = 32) =>
        ThresholdRule.create(
            'sensor-id',
            TelemetryValue.create(w, 'mm/s'),
            TelemetryValue.create(c, 'mm/s'),
            window,
        );

    it('AC2 — creates a valid rule when critical > warning', () => {
        const rule = make(4.5, 7.1);
        expect(rule.getWarningLimit().getNumericValue()).toBe(4.5);
        expect(rule.getCriticalLimit().getNumericValue()).toBe(7.1);
        expect(rule.getWindowSizeSamples()).toBe(32);
        expect(rule.getVersion()).toBe(1);
    });

    it('AC2 — rejects criticalLimit <= warningLimit (422 scenario)', () => {
        expect(() => make(8.0, 6.0)).toThrow(DomainInvariantException);
        expect(() => make(5.0, 5.0)).toThrow(DomainInvariantException);
    });

    it('AC2 — rejects windowSizeSamples outside [3,128]', () => {
        expect(() => make(1, 2, 2)).toThrow(DomainInvariantException);
        expect(() => make(1, 2, 129)).toThrow(DomainInvariantException);
    });

    it('AC2 — rejects mismatched units', () => {
        expect(() =>
            ThresholdRule.create(
                'sid',
                TelemetryValue.create(1, 'mm/s'),
                TelemetryValue.create(2, 'C'),
            ),
        ).toThrow(DomainInvariantException);
    });

    it('updateLimits increments version and preserves invariants', () => {
        const rule = make(4.5, 7.1);
        const updated = rule.updateLimits(
            TelemetryValue.create(3.0, 'mm/s'),
            TelemetryValue.create(6.0, 'mm/s'),
            64,
        );
        expect(updated.getVersion()).toBe(2);
        expect(updated.getWindowSizeSamples()).toBe(64);
        expect(() =>
            updated.updateLimits(
                TelemetryValue.create(6.0, 'mm/s'),
                TelemetryValue.create(4.0, 'mm/s'),
            ),
        ).toThrow(DomainInvariantException);
    });
});