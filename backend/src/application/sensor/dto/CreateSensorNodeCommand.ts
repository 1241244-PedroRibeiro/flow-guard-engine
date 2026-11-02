import { SensorType } from '../../../domain/sensor/SensorType';

export interface CreateSensorNodeCommand {
    lineId: string;
    serialNumber: string;
    sensorType: SensorType;
}