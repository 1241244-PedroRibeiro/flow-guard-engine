import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { SensorModule } from '../../src/presentation/sensor.module';
import { GlobalExceptionFilter } from '../../src/presentation/global_exception.filter';
import { JwtTokenService } from '../../src/infrastructure/security/JwtTokenService';
import { UserRole } from '../../src/domain/user/UserRole';
import { InMemorySensorTelemetryRepository } from '../helpers/fakes/InMemorySensorTelemetryRepository';

describe('SensorNodeController (e2e-in-memory)', () => {
    let app: INestApplication;
    let repo: InMemorySensorTelemetryRepository;
    let engineerToken: string;
    let operatorToken: string;

    beforeAll(async () => {
        repo = new InMemorySensorTelemetryRepository();
        repo.seedLine('line-1');

        const moduleRef = await Test.createTestingModule({
            imports: [SensorModule],
        })
            .overrideProvider('ISensorTelemetryRepository')
            .useValue(repo)
            .compile();

        app = moduleRef.createNestApplication();
        app.setGlobalPrefix('api/v1');
        app.useGlobalFilters(new GlobalExceptionFilter());
        await app.init();

        // Mesmo JwtTokenService que o SensorModule fornece via useFactory.
        // Ambos leem process.env.JWT_SECRET (ou o mesmo fallback), por isso as
        // assinaturas batem certo na verificação feita pelo JwtAuthGuard.
        const tokenService = new JwtTokenService();
        engineerToken = tokenService.sign({
            sub: 'eng-user-id',
            email: 'engineer@flowguard.test',
            roles: [UserRole.ENGINEER],
        });
        operatorToken = tokenService.sign({
            sub: 'op-user-id',
            email: 'operator@flowguard.test',
            roles: [UserRole.OPERATOR],
        });
    });

    afterAll(async () => {
        if (app) {
            await app.close();
        }
    });

    it('POST /api/v1/sensor-nodes → 201 Created (ENGINEER)', async () => {
        const res = await request(app.getHttpServer())
            .post('/api/v1/sensor-nodes')
            .set('Authorization', `Bearer ${engineerToken}`)
            .send({ lineId: 'line-1', serialNumber: 'SN-VIB-9001', sensorType: 'MOTOR_VIBRATION' });
        expect(res.status).toBe(201);
        expect(res.body.serialNumber).toBe('SN-VIB-9001');
    });

    it('POST /api/v1/sensor-nodes → 403 Forbidden (OPERATOR)', async () => {
        const res = await request(app.getHttpServer())
            .post('/api/v1/sensor-nodes')
            .set('Authorization', `Bearer ${operatorToken}`)
            .send({ lineId: 'line-1', serialNumber: 'SN-VIB-0002', sensorType: 'MOTOR_VIBRATION' });
        expect(res.status).toBe(403);
    });

    it('POST /api/v1/sensor-nodes → 409 Conflict on duplicate serial', async () => {
        // Depende do teste #1 ter criado SN-VIB-9001 (Jest executa em ordem).
        const res = await request(app.getHttpServer())
            .post('/api/v1/sensor-nodes')
            .set('Authorization', `Bearer ${engineerToken}`)
            .send({ lineId: 'line-1', serialNumber: 'sn-vib-9001', sensorType: 'MOTOR_VIBRATION' });
        expect(res.status).toBe(409);
    });

    it('PUT .../threshold-rule → 422 when criticalLimit <= warningLimit', async () => {
        const created = await request(app.getHttpServer())
            .post('/api/v1/sensor-nodes')
            .set('Authorization', `Bearer ${engineerToken}`)
            .send({ lineId: 'line-1', serialNumber: 'SN-VIB-9003', sensorType: 'MOTOR_VIBRATION' });

        const res = await request(app.getHttpServer())
            .put(`/api/v1/sensor-nodes/${created.body.id}/threshold-rule`)
            .set('Authorization', `Bearer ${engineerToken}`)
            .send({ warningLimit: 8.0, criticalLimit: 6.0, unit: 'mm/s' });

        expect(res.status).toBe(422);
        expect(res.body.message).toMatch(/strictly greater/);
    });
});