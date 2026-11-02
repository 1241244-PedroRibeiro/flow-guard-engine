import { AlertSeverity } from '../alert/AlertSeverity';
import { DomainInvariantException } from '../common/exceptions/DomainInvariantException';
import { SensorNode } from './SensorNode';
import { SensorType } from './SensorType';
import { ThresholdRule } from './ThresholdRule';
import { SlidingWindowBuffer } from './SlidingWindowBuffer';
import { WindowEvaluation } from './WindowEvaluation';

/**
 * Domain Service — Pipes & Filters Pipeline (KB §12.2, ADR-0004, requirements.md §1.2).
 * Stateful in-memory Ring Buffers per sensor (Map<sensorId, SlidingWindowBuffer>).
 * Warm-up hydration is deterministic from persisted readings (Milestone 1 will optimise).
 */
export class TelemetryEvaluationEngine {
  private readonly buffers = new Map<string, SlidingWindowBuffer>();

  constructor(
    private readonly warmUpWindow: (sensorId: string, capacity: number) => Promise<number[]> = async () => [],
  ) {}

  /** Filter 1: Physical plausibility + active-state guard (→ 422). */
  assertIngestible(
    sensor: SensorNode,
    lineIsActive: boolean,
    rawValue: number,
    unit: string,
    rule: ThresholdRule,
  ): void {
    if (!sensor.getIsActive()) {
      throw new DomainInvariantException('Cannot ingest telemetry for a DEACTIVATED SensorNode.');
    }
    if (!lineIsActive) {
      throw new DomainInvariantException('Cannot ingest telemetry for a DEACTIVATED ConveyorLine.');
    }
    if (!Number.isFinite(rawValue)) {
      throw new DomainInvariantException(`rawValue must be finite; got ${rawValue}.`);
    }
    const ruleUnit = rule.getWarningLimit().getUnit();
    if (ruleUnit !== unit) {
      throw new DomainInvariantException(`Unit mismatch: reading '${unit}' ≠ threshold rule '${ruleUnit}'.`);
    }

    const sensorType = sensor.getSensorType();
    switch (sensorType) {
      case SensorType.BELT_VELOCITY:
      case SensorType.MOTOR_VIBRATION:
      case SensorType.OPTICAL_COUNTER:
        if (rawValue < 0) {
          throw new DomainInvariantException(
            `Negative ${sensorType} value ${rawValue} violates physical plausibility.`,
          );
        }
        break;
      case SensorType.BEARING_TEMPERATURE:
        if (rawValue < -273.15) {
          throw new DomainInvariantException(`Temperature ${rawValue}°C below absolute zero.`);
        }
        break;
      default:
        throw new DomainInvariantException(`Unsupported SensorType: ${sensorType}.`);
    }
  }

  /** Ensures the sensor's ring buffer is present (lazy warm-up on first touch). */
  async ensureBuffer(sensorId: string, capacity: number): Promise<SlidingWindowBuffer> {
    const existing = this.buffers.get(sensorId);
    if (existing && existing.capacity === capacity) return existing;
    const buffer = new SlidingWindowBuffer(capacity);
    if (!existing) {
      const historical = await this.warmUpWindow(sensorId, capacity);
      for (const v of historical) buffer.push(v);
    }
    this.buffers.set(sensorId, buffer);
    return buffer;
  }

  /** Filters 2 & 3: ring buffer aggregation + threshold evaluation. */
  evaluate(buffer: SlidingWindowBuffer, rule: ThresholdRule, rawValue: number): WindowEvaluation {
    buffer.push(rawValue);
    const movingAverage = buffer.movingAverage();
    const movingMedian = buffer.movingMedian();
    const sampleCount = buffer.size;

    const severity = this.classify(movingAverage, rule);
    return {
      movingAverage,
      movingMedian,
      sampleCount,
      breachDetected: severity !== null,
      severity,
    };
  }

  private classify(mu: number, rule: ThresholdRule): AlertSeverity | null {
    const critical = rule.getCriticalLimit().getNumericValue();
    const warning = rule.getWarningLimit().getNumericValue();
    if (mu >= critical) return AlertSeverity.CRITICAL;
    if (mu >= warning) return AlertSeverity.WARNING;
    return null;
  }

  reset(): void {
    this.buffers.clear();
  }

  getBufferCapacity(sensorId: string): number | null {
    return this.buffers.get(sensorId)?.capacity ?? null;
  }
}