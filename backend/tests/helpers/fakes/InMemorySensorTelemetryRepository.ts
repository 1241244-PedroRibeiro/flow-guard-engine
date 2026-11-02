import { SensorNode } from '../../../src/domain/sensor/SensorNode';
import { ThresholdRule } from '../../../src/domain/sensor/ThresholdRule';
import {
    ISensorTelemetryRepository,
    SensorFilter,
} from '../../../src/application/sensor/ports/ISensorTelemetryRepository';

export class InMemorySensorTelemetryRepository implements ISensorTelemetryRepository {
    private sensors = new Map<string, SensorNode>();
    private rules = new Map<string, ThresholdRule>();
    private knownLines = new Set<string>();

    seedLine(lineId: string): void { this.knownLines.add(lineId); }

    async findById(id: string): Promise<SensorNode | null> {
        return this.sensors.get(id) ?? null;
    }

    async findBySerialNumber(serialNumber: string): Promise<SensorNode | null> {
        const target = serialNumber.toUpperCase();
        for (const s of this.sensors.values()) {
            if (s.getSerialNumber().getValue().toUpperCase() === target) return s;
        }
        return null;
    }

    async findByLineId(lineId: string): Promise<SensorNode[]> {
        return [...this.sensors.values()].filter((s) => s.getLineId() === lineId);
    }

    async findAll(filter?: SensorFilter): Promise<SensorNode[]> {
        return [...this.sensors.values()].filter((s) => {
            if (filter?.lineId && s.getLineId() !== filter.lineId) return false;
            if (filter?.sensorType && s.getSensorType() !== filter.sensorType) return false;
            if (filter?.isActive !== undefined && s.getIsActive() !== filter.isActive) return false;
            return true;
        });
    }

    async lineExists(lineId: string): Promise<boolean> {
        return this.knownLines.has(lineId);
    }

    async save(sensor: SensorNode): Promise<void> {
        this.sensors.set(sensor.getId(), sensor);
    }

    async saveThresholdRule(rule: ThresholdRule): Promise<void> {
        this.rules.set(rule.getSensorId(), rule);
    }

    async findThresholdRuleBySensorId(sensorId: string): Promise<ThresholdRule | null> {
        return this.rules.get(sensorId) ?? null;
    }
}