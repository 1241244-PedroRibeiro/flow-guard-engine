export interface ThresholdRuleResponseDto {
    id: string;
    sensorId: string;
    warningLimit: number;
    criticalLimit: number;
    unit: string;
    windowSizeSamples: number;
    version: number;
}

export interface SensorNodeResponseDto {
    id: string;
    lineId: string;
    serialNumber: string;
    sensorType: string;
    isActive: boolean;
    lastCalibratedAt: string | null;
    createdAt: string;
    updatedAt: string;
    thresholdRule: ThresholdRuleResponseDto | null;
}