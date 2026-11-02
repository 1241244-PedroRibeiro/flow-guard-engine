export enum SensorType {
    BELT_VELOCITY = 'BELT_VELOCITY',
    MOTOR_VIBRATION = 'MOTOR_VIBRATION',
    BEARING_TEMPERATURE = 'BEARING_TEMPERATURE',
    OPTICAL_COUNTER = 'OPTICAL_COUNTER',
}

export const SENSOR_TYPES: ReadonlyArray<SensorType> = Object.freeze(Object.values(SensorType));