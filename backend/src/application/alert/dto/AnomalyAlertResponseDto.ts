export interface AnomalyAlertResponseDto {
  id: string;
  sensorId: string;
  lineId: string;
  readingId: string;
  severity: string;
  status: string;
  message: string;
  diagnosticNote: string | null;
  triggeredAt: string;
  acknowledgedAt: string | null;
  acknowledgedBy: string | null;
  resolvedAt: string | null;
}