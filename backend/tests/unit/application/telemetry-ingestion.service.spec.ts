import { TelemetryIngestionService } from '../../../src/application/sensor/TelemetryIngestionService';
import { TelemetryEvaluationEngine } from '../../../src/domain/sensor/TelemetryEvaluationEngine';
import { InMemorySensorTelemetryRepository } from '../../helpers/fakes/InMemorySensorTelemetryRepository';
import { EntityNotFoundException } from '../../../src/domain/common/exceptions/EntityNotFoundException';
import { DomainInvariantException } from '../../../src/domain/common/exceptions/DomainInvariantException';
import { SensorNode } from '../../../src/domain/sensor/SensorNode';
import { SensorType } from '../../../src/domain/sensor/SensorType';
import { SensorSerialNumber } from '../../../src/domain/common/SensorSerialNumber';
import { ThresholdRule } from '../../../src/domain/sensor/ThresholdRule';
import { TelemetryValue } from '../../../src/domain/common/TelemetryValue';
import { ConveyorLine } from '../../../src/domain/topology/ConveyorLine';
import { LineStatus } from '../../../src/domain/topology/LineStatus';

const seed = (repo: InMemorySensorTelemetryRepository, overrides: any = {}) => {
  const now = new Date();
  const sensor = SensorNode.reconstitute(
    's1',
    'l1',
    SensorSerialNumber.create('SN-1'),
    SensorType.MOTOR_VIBRATION,
    overrides.sensorActive ?? true,
    null,
    now,
    now,
    null,
  );
  const rule = ThresholdRule.reconstitute(
    'r1',
    's1',
    TelemetryValue.create(4.5, 'mm/s'),
    TelemetryValue.create(7.1, 'mm/s'),
    4,
    1,
  );
  const line = ConveyorLine.reconstitute({
    id: 'l1',
    sectorId: 'sec1',
    lineCode: 'L1',
    name: 'Line 1',
    operationalStatus: overrides.lineStatus ?? LineStatus.RUNNING,
    isActive: overrides.lineActive ?? true,
    version: 1,
  });
  repo.sensorMap.set('s1', sensor);
  repo.ruleMap.set('s1', rule);
  repo.lineMap.set('l1', line);
};

describe('TelemetryIngestionService', () => {
  let repo: InMemorySensorTelemetryRepository;
  let engine: TelemetryEvaluationEngine;
  let service: TelemetryIngestionService;

  beforeEach(() => {
    repo = new InMemorySensorTelemetryRepository();
    engine = new TelemetryEvaluationEngine();
    service = new TelemetryIngestionService(repo, engine);
  });

  it('AC1/AC2 — normal ingestion returns enriched reading without alert', async () => {
    seed(repo);
    const dto = await service.ingest({ sensorId: 's1', rawValue: 3.2, unit: 'mm/s' });
    expect(dto.evaluation.breachDetected).toBe(false);
    expect(dto.evaluation.triggeredAlertId).toBeNull();
    expect(dto.reading.movingAverage).toBe(3.2);
    expect(repo.readings).toHaveLength(1);
    expect(repo.alerts).toHaveLength(0);
    expect(repo.lineUpdates).toHaveLength(0);
  });

  it('AC2 — WARNING breach creates alert + transitions RUNNING → DEGRADED_WARNING', async () => {
    seed(repo);
    await service.ingest({ sensorId: 's1', rawValue: 4.9, unit: 'mm/s' });
    expect(repo.alerts).toHaveLength(1);
    expect(repo.alerts[0].severity).toBe('WARNING');
    expect(repo.lineUpdates[0]).toEqual({ lineId: 'l1', status: 'DEGRADED_WARNING' });
  });

  it('AC2 — CRITICAL breach creates alert + transitions to FAULT_HALTED', async () => {
    seed(repo);
    const dto = await service.ingest({ sensorId: 's1', rawValue: 7.5, unit: 'mm/s' });
    expect(dto.evaluation.severity).toBe('CRITICAL');
    expect(dto.evaluation.newLineStatus).toBe('FAULT_HALTED');
    expect(repo.alerts[0].severity).toBe('CRITICAL');
  });

  it('AC3 — 404 when sensor missing', async () => {
    await expect(service.ingest({ sensorId: 'unknown', rawValue: 1, unit: 'mm/s' }))
      .rejects.toBeInstanceOf(EntityNotFoundException);
  });

  it('AC3 — 422 when sensor is deactivated', async () => {
    seed(repo, { sensorActive: false });
    await expect(service.ingest({ sensorId: 's1', rawValue: 1, unit: 'mm/s' }))
      .rejects.toBeInstanceOf(DomainInvariantException);
  });

  it('AC3 — 422 on negative vibration', async () => {
    seed(repo);
    await expect(service.ingest({ sensorId: 's1', rawValue: -1, unit: 'mm/s' }))
      .rejects.toBeInstanceOf(DomainInvariantException);
  });

  it('AC4 — listReadings is paginated and ordered DESC', async () => {
    seed(repo);
    for (let i = 0; i < 25; i++) {
      await service.ingest({
        sensorId: 's1',
        rawValue: 1 + i * 0.01,
        unit: 'mm/s',
        recordedAt: new Date(2026, 0, 1, 0, 0, i).toISOString(),
      });
    }
    const page1 = await service.listReadings({ sensorId: 's1', page: 1, pageSize: 10 });
    expect(page1.items).toHaveLength(10);
    expect(page1.total).toBe(25);
    expect(page1.totalPages).toBe(3);
    const t1 = new Date(page1.items[0].recordedAt).getTime();
    const t2 = new Date(page1.items[1].recordedAt).getTime();
    expect(t1).toBeGreaterThanOrEqual(t2);
  });

  it('AC2 — atomicity: single DB roundtrip when alert fires', async () => {
    seed(repo);
    await service.ingest({ sensorId: 's1', rawValue: 8.0, unit: 'mm/s' });
    expect(repo.atomicWrites).toBe(1);
  });
});