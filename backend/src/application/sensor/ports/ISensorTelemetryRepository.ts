import { SensorNode } from '../../../domain/sensor/SensorNode';
import { ThresholdRule } from '../../../domain/sensor/ThresholdRule';
import { ConveyorLine } from '../../../domain/topology/ConveyorLine';
import { LineStatus } from '../../../domain/topology/LineStatus';
import { TelemetryReading } from '../../../domain/sensor/TelemetryReading';
import { AnomalyAlert } from '../../../domain/alert/AnomalyAlert';
import { SensorType } from '../../../domain/sensor/SensorType';

export interface SensorFilter {
  lineId?: string;
  sensorType?: SensorType;
  isActive?: boolean;
}

export interface SensorIngestionContext {
  sensor: SensorNode;
  thresholdRule: ThresholdRule | null;
  line: ConveyorLine;
}

/**
 * Atomic ingestion unit (AC2 — KB §23.1): reading + optional alert + optional line
 * mutation MUST happen in one ACID transaction.
 */
export interface IngestTelemetryAtomicallyCommand {
  reading: TelemetryReading;
  alert: AnomalyAlert | null;
  newLineStatusIfBreach: LineStatus | null;
}

export interface ISensorTelemetryRepository {
  // --- existing baseline methods (FG03) ---
  findById(id: string): Promise<SensorNode | null>;
  findBySerialNumber(serialNumber: string): Promise<SensorNode | null>;
  findByLineId(lineId: string): Promise<SensorNode[]>;
  findAll(filter?: SensorFilter): Promise<SensorNode[]>;
  lineExists(lineId: string): Promise<boolean>;
  save(sensor: SensorNode): Promise<void>;
  saveThresholdRule(rule: ThresholdRule): Promise<void>;
  findThresholdRuleBySensorId(sensorId: string): Promise<ThresholdRule | null>;

  // --- FG04 additions ---
  findIngestionContext(sensorId: string): Promise<SensorIngestionContext | null>;
  findRecentRawValues(sensorId: string, limit: number): Promise<number[]>;
  ingestTelemetryAtomically(cmd: IngestTelemetryAtomicallyCommand): Promise<void>;
  findReadingsBySensorIdPaginated(
    sensorId: string,
    page: number,
    pageSize: number,
  ): Promise<{ items: TelemetryReading[]; total: number }>;
}