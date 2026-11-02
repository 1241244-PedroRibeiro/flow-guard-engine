export interface TelemetryReadingResponseDto {
  id: string;
  sensorId: string;
  rawValue: number;
  movingAverage: number;
  movingMedian: number;
  unit: string;
  windowSampleCount: number;
  recordedAt: string;
}