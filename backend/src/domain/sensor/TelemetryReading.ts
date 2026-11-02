import { DomainInvariantException } from '../common/exceptions/DomainInvariantException';

export interface TelemetryReadingProps {
  id: string;
  sensorId: string;
  rawValue: number;
  movingAverage: number;
  movingMedian: number;
  unit: string;
  windowSampleCount: number;
  recordedAt: Date;
}

export class TelemetryReading {
  private constructor(private readonly props: TelemetryReadingProps) {}

  static create(props: TelemetryReadingProps): TelemetryReading {
    if (!Number.isFinite(props.rawValue)) {
      throw new DomainInvariantException('TelemetryReading.rawValue must be finite.');
    }
    if (!Number.isFinite(props.movingAverage) || !Number.isFinite(props.movingMedian)) {
      throw new DomainInvariantException('TelemetryReading window metrics must be finite.');
    }
    if (!Number.isInteger(props.windowSampleCount) || props.windowSampleCount < 1) {
      throw new DomainInvariantException('TelemetryReading.windowSampleCount must be integer ≥ 1.');
    }
    if (!props.unit || props.unit.trim().length === 0) {
      throw new DomainInvariantException('TelemetryReading.unit must be non-empty.');
    }
    return new TelemetryReading(props);
  }

  get id(): string { return this.props.id; }
  get sensorId(): string { return this.props.sensorId; }
  get rawValue(): number { return this.props.rawValue; }
  get movingAverage(): number { return this.props.movingAverage; }
  get movingMedian(): number { return this.props.movingMedian; }
  get unit(): string { return this.props.unit; }
  get windowSampleCount(): number { return this.props.windowSampleCount; }
  get recordedAt(): Date { return this.props.recordedAt; }
}