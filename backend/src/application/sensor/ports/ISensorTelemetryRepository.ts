import { SensorNode } from '../../../domain/sensor/SensorNode';
import { ThresholdRule } from '../../../domain/sensor/ThresholdRule';
import { SensorType } from '../../../domain/sensor/SensorType';

export interface SensorFilter {
    lineId?: string;
    sensorType?: SensorType;
    isActive?: boolean;
}

export interface ISensorTelemetryRepository {
    findById(id: string): Promise<SensorNode | null>;
    findBySerialNumber(serialNumber: string): Promise<SensorNode | null>;
    findByLineId(lineId: string): Promise<SensorNode[]>;
    findAll(filter?: SensorFilter): Promise<SensorNode[]>;
    lineExists(lineId: string): Promise<boolean>;
    save(sensor: SensorNode): Promise<void>;
    saveThresholdRule(rule: ThresholdRule): Promise<void>;
    findThresholdRuleBySensorId(sensorId: string): Promise<ThresholdRule | null>;
}