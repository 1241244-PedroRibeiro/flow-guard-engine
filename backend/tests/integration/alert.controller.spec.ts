import { Test } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import { APP_FILTER } from '@nestjs/core';
import request from 'supertest';
import { AnomalyAlertController } from '../../src/presentation/http/controllers/AnomalyAlertController';
import { AnomalyAlertService } from '../../src/application/alert/AnomalyAlertService';
import { GlobalExceptionFilter } from '../../src/presentation/global_exception.filter';
import { JwtAuthGuard } from '../../src/presentation/http/guards/JwtAuthGuard';
import { RolesGuard } from '../../src/presentation/http/guards/RolesGuard';
import { InMemoryAnomalyAlertRepository } from '../helpers/fakes/InMemoryAnomalyAlertRepository';
import { AnomalyAlert } from '../../src/domain/alert/AnomalyAlert';
import { AlertSeverity } from '../../src/domain/alert/AlertSeverity';
import { AlertStatus } from '../../src/domain/alert/AlertStatus';

const ALERT_UUID = '11111111-1111-4111-8111-111111111111';

const buildSeededRepo = () => {
  const repo = new InMemoryAnomalyAlertRepository();
  const alert = AnomalyAlert.create({
    id: ALERT_UUID, sensorId: 's1', lineId: 'l1', readingId: 'r1',
    severity: AlertSeverity.CRITICAL, message: 'crit', triggeredAt: new Date(),
  });
  repo.alerts.set(ALERT_UUID, alert);
  return repo;
};

describe('AnomalyAlertController', () => {
  let app: INestApplication;
  let repo: InMemoryAnomalyAlertRepository;

  beforeEach(async () => {
    repo = buildSeededRepo();

    const moduleRef = await Test.createTestingModule({
      controllers: [AnomalyAlertController],
      providers: [
        AnomalyAlertService,
        { provide: 'IAnomalyAlertRepository', useValue: repo },
        { provide: APP_FILTER, useClass: GlobalExceptionFilter },
      ],
    })
      .overrideProvider(AnomalyAlertService)
      .useFactory({
        factory: (r: any) => new AnomalyAlertService(r),
        inject: ['IAnomalyAlertRepository'],
      })
      .overrideGuard(JwtAuthGuard).useValue({ canActivate: (ctx: any) => {
        const req = ctx.switchToHttp().getRequest();
        req.user = { sub: 'test-user-id' };
        return true;
      }})
      .overrideGuard(RolesGuard).useValue({ canActivate: () => true })
      .compile();

    app = moduleRef.createNestApplication();
    await app.init();
  });

  afterEach(async () => {
    await app.close();
  });

  it('AC2 — 200 OK on acknowledge', async () => {
    const res = await request(app.getHttpServer())
      .post(`/anomaly-alerts/${ALERT_UUID}/acknowledge`)
      .send({ diagnosticNote: 'Inspecting the motor' });
    expect(res.status).toBe(200);
    expect(res.body.status).toBe(AlertStatus.ACKNOWLEDGED);
    expect(res.body.acknowledgedBy).toBe('test-user-id');
  });

  it('AC3 — 200 OK on resolve', async () => {
    await repo.alerts.get(ALERT_UUID)!.acknowledge('u1', 'Done');
    const res = await request(app.getHttpServer())
      .post(`/anomaly-alerts/${ALERT_UUID}/resolve`);
    expect(res.status).toBe(200);
    expect(res.body.status).toBe(AlertStatus.RESOLVED);
  });

  it('AC4 — 409 Conflict on invalid state transition', async () => {
    const res = await request(app.getHttpServer())
      .post(`/anomaly-alerts/${ALERT_UUID}/resolve`); // Try resolving an OPEN alert
    expect(res.status).toBe(409);
    expect(res.body.message).toMatch(/must be ACKNOWLEDGED/);
  });

  it('400 — Joi boundary validation on short note', async () => {
    const res = await request(app.getHttpServer())
      .post(`/anomaly-alerts/${ALERT_UUID}/acknowledge`)
      .send({ diagnosticNote: 'ok' }); // too short
    expect(res.status).toBe(400);
  });

  it('404 — unknown alert', async () => {
    const res = await request(app.getHttpServer())
      .post(`/anomaly-alerts/99999999-9999-4999-8999-999999999999/acknowledge`)
      .send({ diagnosticNote: 'Valid note' });
    expect(res.status).toBe(404);
  });

  it('AC1 — GET paginated & filtered', async () => {
    const res = await request(app.getHttpServer())
      .get(`/anomaly-alerts?status=OPEN&severity=CRITICAL&page=1&pageSize=10`);
    expect(res.status).toBe(200);
    expect(res.body.items).toHaveLength(1);
    expect(res.body.total).toBe(1);
  });
});