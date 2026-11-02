import { AlertSeverity } from '../alert/AlertSeverity';

export interface WindowEvaluation {
  readonly movingAverage: number;
  readonly movingMedian: number;
  readonly sampleCount: number;
  readonly breachDetected: boolean;
  readonly severity: AlertSeverity | null;
}

export const NO_BREACH: WindowEvaluation = Object.freeze({
  movingAverage: 0,
  movingMedian: 0,
  sampleCount: 0,
  breachDetected: false,
  severity: null,
});