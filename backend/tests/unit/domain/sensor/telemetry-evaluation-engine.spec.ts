import { TelemetryEvaluationEngine } from '../../../../src/domain/sensor/TelemetryEvaluationEngine';
import { SlidingWindowBuffer } from '../../../../src/domain/sensor/SlidingWindowBuffer';
import { SensorNode } from '../../../../src/domain/sensor/SensorNode';
import { SensorType } from '../../../../src/domain/sensor/SensorType';
import { SensorSerialNumber } from '../../../../src/domain/common/SensorSerialNumber';
import { ThresholdRule } from '../../../../src/domain/sensor/ThresholdRule';
import { TelemetryValue } from '../../../../src/domain/common/TelemetryValue';
import { AlertSeverity } from '../../../../src/domain/alert/AlertSeverity';
import { DomainInvariantException } from '../../../../src/domain/common/exceptions/DomainInvariantException';

const makeSensor = (overrides: any = {}): SensorNode => {
  const now = new Date();
  return SensorNode.reconstitute(
    overrides.id ?? 's1',
    overrides.lineId ?? 'l1',
    SensorSerialNumber.create(overrides.serialNumber ?? 'SN-1'),
    overrides.sensorType ?? SensorType.MOTOR_VIBRATION,
    overrides.isActive ?? true,
    null,
    now,
    now,
    null,
  );
};

const makeRule = (overrides: any = {}): ThresholdRule => {
  const unit = overrides.unit ?? 'mm/s';
  return ThresholdRule.reconstitute(
    'r1',
    overrides.sensorId ?? 's1',
    TelemetryValue.create(overrides.warningLimit ?? 4.5, unit),
    TelemetryValue.create(overrides.criticalLimit ?? 7.1, unit),
    overrides.windowSizeSamples ?? 4,
    1,
  );
};

describe('TelemetryEvaluationEngine', () => {
  it('Filter 1: rejects deactivated sensor', () => {
    const e = new TelemetryEvaluationEngine();
    expect(() => e.assertIngestible(makeSensor({ isActive: false }), true, 1, 'mm/s', makeRule()))
      .toThrow(/DEACTIVATED SensorNode/);
  });

  it('Filter 1: rejects deactivated line', () => {
    const e = new TelemetryEvaluationEngine();
    expect(() => e.assertIngestible(makeSensor(), false, 1, 'mm/s', makeRule()))
      .toThrow(/DEACTIVATED ConveyorLine/);
  });

  it('Filter 1: rejects non-finite rawValue', () => {
    const e = new TelemetryEvaluationEngine();
    expect(() => e.assertIngestible(makeSensor(), true, NaN, 'mm/s', makeRule()))
      .toThrow(/rawValue must be finite/);
  });

  it('Filter 1: rejects negative vibration', () => {
    const e = new TelemetryEvaluationEngine();
    expect(() => e.assertIngestible(makeSensor(), true, -0.1, 'mm/s', makeRule()))
      .toThrow(DomainInvariantException);
  });

  it('Filter 1: rejects temperature below absolute zero', () => {
    const e = new TelemetryEvaluationEngine();
    const rule = makeRule({ unit: 'C' });
    expect(() => e.assertIngestible(makeSensor({ sensorType: SensorType.BEARING_TEMPERATURE }), true, -300, 'C', rule))
      .toThrow(/below absolute zero/);
  });

  it('Filter 1: rejects unit mismatch', () => {
    const e = new TelemetryEvaluationEngine();
    expect(() => e.assertIngestible(makeSensor(), true, 5, 'm/s', makeRule()))
      .toThrow(/Unit mismatch/);
  });

  it('Filter 3: no breach when μ_W < warningLimit', () => {
    const e = new TelemetryEvaluationEngine();
    const rule = makeRule();
    const buffer = new SlidingWindowBuffer(4);
    [3, 4].forEach((v) => buffer.push(v));
    const res = e.evaluate(buffer, rule, 3.5);
    expect(res.breachDetected).toBe(false);
    expect(res.severity).toBeNull();
  });

  it('Filter 3: WARNING when warningLimit ≤ μ_W < criticalLimit', () => {
    const e = new TelemetryEvaluationEngine();
    const rule = makeRule();
    const buffer = new SlidingWindowBuffer(4);
    [4.6, 4.7].forEach((v) => buffer.push(v));
    const res = e.evaluate(buffer, rule, 4.8);
    expect(res.breachDetected).toBe(true);
    expect(res.severity).toBe(AlertSeverity.WARNING);
  });

  it('Filter 3: CRITICAL when μ_W ≥ criticalLimit', () => {
    const e = new TelemetryEvaluationEngine();
    const rule = makeRule();
    const buffer = new SlidingWindowBuffer(4);
    [7.2, 7.5].forEach((v) => buffer.push(v));
    const res = e.evaluate(buffer, rule, 7.3);
    expect(res.severity).toBe(AlertSeverity.CRITICAL);
  });

  it('ensureBuffer lazily hydrates from warm-up callback', async () => {
    const e = new TelemetryEvaluationEngine(async () => [1, 2, 3]);
    const buf = await e.ensureBuffer('s1', 4);
    expect(buf.snapshot()).toEqual([1, 2, 3]);
    expect(e.getBufferCapacity('s1')).toBe(4);
  });
});