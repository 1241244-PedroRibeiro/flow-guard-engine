export interface QueryTelemetryReadingsQuery {
  sensorId: string;
  page: number;    // ≥ 1
  pageSize: number; // 1..100
}