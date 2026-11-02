import { Test } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import { APP_FILTER } from '@nestjs/core';
import request from 'supertest';
import { TelemetryIngestionController } from '../../src/presentation/http/controllers/TelemetryIngestionController';
import { TelemetryIngestionService } from '../../src/application/sensor/TelemetryIngestionService';
import { TelemetryEvaluationEngine } from '../../src/domain/sensor/TelemetryEvaluationEngine';
import { GlobalExceptionFilter } from '../../src/presentation/global_exception.filter';
import { JwtAuthGuard } from '../../src/presentation/http/guards/JwtAuthGuard';
import { RolesGuard } from '../../src/presentation/http/guards/RolesGuard';
import { InMemorySensorTelemetryRepository } from '../helpers/fakes/InMemorySensorTelemetryRepository';
import { SensorNode } from '../../src/domain/sensor/SensorNode';
import { SensorType } from '../../src/domain/sensor/SensorType';
import { SensorSerialNumber } from '../../src/domain/common/SensorSerialNumber';
import { ThresholdRule } from '../../src/domain/sensor/ThresholdRule';
import { TelemetryValue } from '../../src/domain/common/TelemetryValue';
import { ConveyorLine } from '../../src/domain/topology/ConveyorLine';
import { LineStatus } from '../../src/domain/topology/LineStatus';

const SENSOR_UUID = '11111111-1111-4111-8111-111111111111';
const LINE_UUID = '22222222-2222-4222-8222-222222222222';

const buildSeededRepo = () => {
  const repo = new InMemorySensorTelemetryRepository();
  const now = new Date();

  repo.sensorMap.set(
    SENSOR_UUID,
    SensorNode.reconstitute(
      SENSOR_UUID,
      LINE_UUID,
      SensorSerialNumber.create('SN-1'),
      SensorType.MOTOR_VIBRATION,
      true,
      null,
      now,
      now,
      null,
    ),
  );
  repo.ruleMap.set(
    SENSOR_UUID,
    ThresholdRule.reconstitute(
      'r1',
      SENSOR_UUID,
      TelemetryValue.create(4.5, 'mm/s'),
      TelemetryValue.create(7.1, 'mm/s'),
      8,
      1,
    ),
  );
  repo.lineMap.set(
    LINE_UUID,
    ConveyorLine.reconstitute({
      id: LINE_UUID,
      sectorId: 'sec',
      lineCode: 'L1',
      name: 'Line 1',
      operationalStatus: LineStatus.RUNNING,
      isActive: true,
      version: 1,
    }),
  );
  return repo;
};

describe('TelemetryIngestionController (NestJS in-memory)', () => {
  let app: INestApplication;
  let repo: InMemorySensorTelemetryRepository;

  beforeEach(async () => {
    repo = buildSeededRepo();

    const moduleRef = await Test.createTestingModule({
      controllers: [TelemetryIngestionController],
      providers: [
        TelemetryIngestionService,
        { provide: 'ISensorTelemetryRepository', useValue: repo },
        { provide: TelemetryEvaluationEngine, useValue: new TelemetryEvaluationEngine() },
        { provide: APP_FILTER, useClass: GlobalExceptionFilter },
      ],
    })
      .overrideProvider(TelemetryIngestionService)
      .useFactory({
        factory: (r: any, e: any) => new TelemetryIngestionService(r, e),
        inject: ['ISensorTelemetryRepository', TelemetryEvaluationEngine],
      })
      .overrideGuard(JwtAuthGuard).useValue({ canActivate: () => true })
      .overrideGuard(RolesGuard).useValue({ canActivate: () => true })
      .compile();

    app = moduleRef.createNestApplication();
    await app.init();
  });

  afterEach(async () => {
    await app.close();
  });

  it('AC1 — 201 on normal ingestion', async () => {
    const res = await request(app.getHttpServer())
      .post(`/sensor-nodes/${SENSOR_UUID}/telemetry-readings`)
      .send({ rawValue: 3.2, unit: 'mm/s' });
    expect(res.status).toBe(201);
    expect(res.body.reading).toMatchObject({ rawValue: 3.2, unit: 'mm/s', windowSampleCount: 1 });
    expect(res.body.evaluation.breachDetected).toBe(false);
  });

  it('AC2 — 201 with alert + FAULT_HALTED on critical', async () => {
    const res = await request(app.getHttpServer())
      .post(`/sensor-nodes/${SENSOR_UUID}/telemetry-readings`)
      .send({ rawValue: 7.5, unit: 'mm/s' });
    expect(res.status).toBe(201);
    expect(res.body.evaluation.severity).toBe('CRITICAL');
    expect(res.body.evaluation.newLineStatus).toBe('FAULT_HALTED');
    expect(repo.alerts).toHaveLength(1);
  });

  it('AC3 — 422 on negative vibration (mapped by GlobalExceptionFilter)', async () => {
    const res = await request(app.getHttpServer())
      .post(`/sensor-nodes/${SENSOR_UUID}/telemetry-readings`)
      .send({ rawValue: -3, unit: 'mm/s' });
    expect(res.status).toBe(422);
  });

  it('400 — malformed UUID via ParseUUIDPipe', async () => {
    const res = await request(app.getHttpServer())
      .post('/sensor-nodes/not-a-uuid/telemetry-readings')
      .send({ rawValue: 1, unit: 'mm/s' });
    expect(res.status).toBe(400);
  });

  it('400 — mass-assignment / unknown fields stripped by JoiValidationPipe', async () => {
    const res = await request(app.getHttpServer())
      .post(`/sensor-nodes/${SENSOR_UUID}/telemetry-readings`)
      .send({ rawValue: 1, unit: 'mm/s', id: 'hacked', movingAverage: 999 });
    expect(res.status).toBe(201);
    expect(res.body.reading.movingAverage).not.toBe(999);
    expect(res.body.reading.id).not.toBe('hacked');
  });

  it('404 — unknown sensor (mapped by GlobalExceptionFilter)', async () => {
    const res = await request(app.getHttpServer())
      .post('/sensor-nodes/99999999-9999-4999-8999-999999999999/telemetry-readings')
      .send({ rawValue: 1, unit: 'mm/s' });
    expect(res.status).toBe(404);
  });

  it('AC4 — GET paginated', async () => {
    for (let i = 0; i < 3; i++) {
      await request(app.getHttpServer())
        .post(`/sensor-nodes/${SENSOR_UUID}/telemetry-readings`)
        .send({ rawValue: 1 + i, unit: 'mm/s' });
    }
    const res = await request(app.getHttpServer())
      .get(`/sensor-nodes/${SENSOR_UUID}/telemetry-readings?page=1&pageSize=2`);
    expect(res.status).toBe(200);
    expect(res.body.items).toHaveLength(2);
    expect(res.body.total).toBe(3);
  });

  it('400 — page/pageSize bounds via JoiValidationPipe', async () => {
    const res = await request(app.getHttpServer())
      .get(`/sensor-nodes/${SENSOR_UUID}/telemetry-readings?page=0&pageSize=101`);
    expect(res.status).toBe(400);
  });
});