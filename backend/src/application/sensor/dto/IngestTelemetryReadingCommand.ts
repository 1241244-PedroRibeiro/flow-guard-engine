export interface IngestTelemetryReadingCommand {
  sensorId: string;
  rawValue: number;
  unit: string;
  recordedAt?: string; // ISO-8601
}