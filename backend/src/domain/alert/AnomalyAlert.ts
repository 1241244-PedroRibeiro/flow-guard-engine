import { AlertSeverity } from './AlertSeverity';
import { AlertStatus } from './AlertStatus';
import { DomainInvariantException } from '../common/exceptions/DomainInvariantException';

export interface AnomalyAlertProps {
  id: string;
  sensorId: string;
  lineId: string;
  readingId: string;
  severity: AlertSeverity;
  status: AlertStatus;
  message: string;
  diagnosticNote: string | null;
  triggeredAt: Date;
  acknowledgedAt: Date | null;
  acknowledgedBy: string | null;
  resolvedAt: Date | null;
}

/**
 * Aggregate Root: AnomalyAlert (KB §10.2, §22.4)
 * Lifecycle: OPEN → ACKNOWLEDGED → RESOLVED
 */
export class AnomalyAlert {
  private constructor(private readonly props: AnomalyAlertProps) {}

  static create(
    props: Omit<AnomalyAlertProps, 'status' | 'diagnosticNote' | 'acknowledgedAt' | 'acknowledgedBy' | 'resolvedAt'>,
  ): AnomalyAlert {
    if (!props.message || props.message.trim().length === 0) {
      throw new DomainInvariantException('AnomalyAlert.message must be non-empty.');
    }
    return new AnomalyAlert({
      ...props,
      status: AlertStatus.OPEN,
      diagnosticNote: null,
      acknowledgedAt: null,
      acknowledgedBy: null,
      resolvedAt: null,
    });
  }

  static reconstitute(props: AnomalyAlertProps): AnomalyAlert {
    return new AnomalyAlert(props);
  }

  get id(): string { return this.props.id; }
  get sensorId(): string { return this.props.sensorId; }
  get lineId(): string { return this.props.lineId; }
  get readingId(): string { return this.props.readingId; }
  get severity(): AlertSeverity { return this.props.severity; }
  get status(): AlertStatus { return this.props.status; }
  get message(): string { return this.props.message; }
  get diagnosticNote(): string | null { return this.props.diagnosticNote; }
  get triggeredAt(): Date { return this.props.triggeredAt; }
  get acknowledgedAt(): Date | null { return this.props.acknowledgedAt; }
  get acknowledgedBy(): string | null { return this.props.acknowledgedBy; }
  get resolvedAt(): Date | null { return this.props.resolvedAt; }

  acknowledge(userId: string, note: string): void {
    if (this.props.status !== AlertStatus.OPEN) {
      throw new DomainInvariantException(`Cannot acknowledge alert in status ${this.props.status}.`);
    }
    if (!userId) throw new DomainInvariantException('acknowledgedBy is required.');
    this.props.status = AlertStatus.ACKNOWLEDGED;
    this.props.acknowledgedBy = userId;
    this.props.acknowledgedAt = new Date();
    this.props.diagnosticNote = note;
  }

  resolve(): void {
    if (this.props.status !== AlertStatus.ACKNOWLEDGED) {
      throw new DomainInvariantException(`Cannot resolve alert in status ${this.props.status}.`);
    }
    this.props.status = AlertStatus.RESOLVED;
    this.props.resolvedAt = new Date();
  }
}