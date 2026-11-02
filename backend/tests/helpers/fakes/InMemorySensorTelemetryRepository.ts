import {
  ISensorTelemetryRepository,
  IngestTelemetryAtomicallyCommand,
  SensorFilter,
  SensorIngestionContext,
} from '../../../src/application/sensor/ports/ISensorTelemetryRepository';
import { SensorNode } from '../../../src/domain/sensor/SensorNode';
import { ThresholdRule } from '../../../src/domain/sensor/ThresholdRule';
import { ConveyorLine } from '../../../src/domain/topology/ConveyorLine';
import { LineStatus } from '../../../src/domain/topology/LineStatus';
import { TelemetryReading } from '../../../src/domain/sensor/TelemetryReading';

export class InMemorySensorTelemetryRepository implements ISensorTelemetryRepository {
  public sensorMap = new Map<string, SensorNode>();
  public ruleMap = new Map<string, ThresholdRule>();
  public lineMap = new Map<string, ConveyorLine>();
  public readings: TelemetryReading[] = [];
  public alerts: any[] = [];
  public lineUpdates: Array<{ lineId: string; status: string }> = [];
  public atomicWrites = 0;

  /**
   * Helper de testes: cria uma ConveyorLine mínima para satisfazer
   * dependências de integridade referencial em testes de sensores.
   */
  seedLine(lineId: string): void {
    this.lineMap.set(
      lineId,
      ConveyorLine.reconstitute({
        id: lineId,
        sectorId: 'sector-1',
        lineCode: `L-${lineId}`,
        name: `Line ${lineId}`,
        operationalStatus: LineStatus.RUNNING,
        isActive: true,
        version: 1,
      }),
    );
  }

  async findById(id: string) { return this.sensorMap.get(id) ?? null; }
  
  async findBySerialNumber(sn: string) {
    return [...this.sensorMap.values()].find((s) => s.getSerialNumber().getValue() === sn) ?? null;
  }
  
  async findByLineId(lineId: string) {
    return [...this.sensorMap.values()].filter((s) => s.getLineId() === lineId);
  }
  
  async findAll(filter?: SensorFilter) {
    return [...this.sensorMap.values()].filter((s) => {
      if (filter?.lineId && s.getLineId() !== filter.lineId) return false;
      if (filter?.sensorType && s.getSensorType() !== filter.sensorType) return false;
      if (filter?.isActive !== undefined && s.getIsActive() !== filter.isActive) return false;
      return true;
    });
  }
  
  async lineExists(lineId: string) { return this.lineMap.has(lineId); }
  
  async save(s: SensorNode) { this.sensorMap.set(s.getId(), s); }
  
  async saveThresholdRule(r: ThresholdRule) { this.ruleMap.set(r.getSensorId(), r); }
  
  async findThresholdRuleBySensorId(sensorId: string) { return this.ruleMap.get(sensorId) ?? null; }

  async findIngestionContext(sensorId: string): Promise<SensorIngestionContext | null> {
    const sensor = this.sensorMap.get(sensorId);
    if (!sensor) return null;
    const line = this.lineMap.get(sensor.getLineId());
    if (!line) return null;
    return {
      sensor,
      thresholdRule: this.ruleMap.get(sensorId) ?? null,
      line,
    };
  }

  async findRecentRawValues(sensorId: string, limit: number): Promise<number[]> {
    return this.readings
      .filter((r) => r.sensorId === sensorId)
      .slice(-limit)
      .map((r) => r.rawValue);
  }

  async ingestTelemetryAtomically(cmd: IngestTelemetryAtomicallyCommand): Promise<void> {
    this.atomicWrites++;
    this.readings.push(cmd.reading);
    if (cmd.alert) this.alerts.push(cmd.alert);
    if (cmd.alert && cmd.newLineStatusIfBreach) {
      this.lineUpdates.push({ lineId: cmd.alert.lineId, status: cmd.newLineStatusIfBreach });
    }
  }

  async findReadingsBySensorIdPaginated(sensorId: string, page: number, pageSize: number) {
    const all = this.readings
      .filter((r) => r.sensorId === sensorId)
      .sort((a, b) => b.recordedAt.getTime() - a.recordedAt.getTime());
    return {
      items: all.slice((page - 1) * pageSize, page * pageSize),
      total: all.length,
    };
  }
}