import { SensorManagementService } from '../../../src/application/sensor/SensorManagementService';
import {
    EntityNotFoundException,
    ResourceConflictException,
} from '../../../src/domain/common/exceptions';
import { SensorType } from '../../../src/domain/sensor/SensorType';
import { InMemorySensorTelemetryRepository } from '../../helpers/fakes/InMemorySensorTelemetryRepository';

describe('SensorManagementService', () => {
    let repo: InMemorySensorTelemetryRepository;
    let service: SensorManagementService;

    beforeEach(() => {
        repo = new InMemorySensorTelemetryRepository();
        repo.seedLine('line-1');
        service = new SensorManagementService(repo);
    });

    it('AC1 — registers sensor on existing line', async () => {
        const dto = await service.registerSensor({
            lineId: 'line-1',
            serialNumber: 'sn-vib-9001',
            sensorType: SensorType.MOTOR_VIBRATION,
        });
        expect(dto.serialNumber).toBe('SN-VIB-9001');
        expect(dto.isActive).toBe(true);
    });

    it('AC1 — throws EntityNotFoundException when line missing (→ 404)', async () => {
        await expect(
            service.registerSensor({
                lineId: 'nope',
                serialNumber: 'SN-VIB-0001',
                sensorType: SensorType.MOTOR_VIBRATION,
            }),
        ).rejects.toBeInstanceOf(EntityNotFoundException);
    });

    it('AC1 — throws ResourceConflictException on duplicate serial (→ 409)', async () => {
        await service.registerSensor({
            lineId: 'line-1', serialNumber: 'SN-VIB-9001', sensorType: SensorType.MOTOR_VIBRATION,
        });
        await expect(
            service.registerSensor({
                lineId: 'line-1', serialNumber: 'sn-vib-9001', sensorType: SensorType.BELT_VELOCITY,
            }),
        ).rejects.toBeInstanceOf(ResourceConflictException);
    });

    it('AC2 — upserts a valid threshold rule', async () => {
        const s = await service.registerSensor({
            lineId: 'line-1', serialNumber: 'SN-VIB-9001', sensorType: SensorType.MOTOR_VIBRATION,
        });
        const r = await service.upsertThresholdRule(s.id, {
            warningLimit: 4.5, criticalLimit: 7.1, unit: 'mm/s',
        });
        expect(r.criticalLimit).toBe(7.1);
        expect(r.windowSizeSamples).toBe(32);
    });

    it('AC3 — filters by lineId + sensorType + isActive', async () => {
        const s1 = await service.registerSensor({
            lineId: 'line-1', serialNumber: 'SN-VIB-9001', sensorType: SensorType.MOTOR_VIBRATION,
        });
        await service.registerSensor({
            lineId: 'line-1', serialNumber: 'SN-VEL-9002', sensorType: SensorType.BELT_VELOCITY,
        });
        await service.deactivateSensor(s1.id);

        const active = await service.listSensors({ isActive: true });
        expect(active).toHaveLength(1);
        const vibs = await service.listSensors({ sensorType: SensorType.MOTOR_VIBRATION });
        expect(vibs).toHaveLength(1);
    });

    it('AC4 — deactivates a sensor', async () => {
        const s = await service.registerSensor({
            lineId: 'line-1', serialNumber: 'SN-VIB-9001', sensorType: SensorType.MOTOR_VIBRATION,
        });
        const out = await service.deactivateSensor(s.id);
        expect(out.isActive).toBe(false);
    });
});