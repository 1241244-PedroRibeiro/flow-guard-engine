import { TelemetryReadingResponseDto } from './TelemetryReadingResponseDto';

export interface TelemetryIngestionEvaluationResponseDto {
  reading: TelemetryReadingResponseDto;
  evaluation: {
    breachDetected: boolean;
    severity: 'WARNING' | 'CRITICAL' | null;
    previousLineStatus: string;
    newLineStatus: string;
    triggeredAlertId: string | null;
  };
}