import { AlertSeverity } from './AlertSeverity';
import { AlertStatus } from './AlertStatus';
import { DomainInvariantException } from '../common/exceptions/DomainInvariantException';
import { ResourceConflictException } from '../common/exceptions/ResourceConflictException';

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
      throw new ResourceConflictException(`Cannot acknowledge alert in status ${this.props.status}. Only OPEN alerts can be acknowledged.`);
    }
    if (!userId) {
      throw new DomainInvariantException('acknowledgedBy is required.');
    }
    const trimmedNote = note?.trim() ?? '';
    if (trimmedNote.length < 3 || trimmedNote.length > 500) {
      throw new DomainInvariantException('Diagnostic note must be between 3 and 500 characters.');
    }

    this.props.status = AlertStatus.ACKNOWLEDGED;
    this.props.acknowledgedBy = userId;
    this.props.acknowledgedAt = new Date();
    this.props.diagnosticNote = trimmedNote;
  }

  resolve(): void {
    if (this.props.status !== AlertStatus.ACKNOWLEDGED) {
      throw new ResourceConflictException(`Cannot resolve alert in status ${this.props.status}. Alert must be ACKNOWLEDGED before resolution.`);
    }
    this.props.status = AlertStatus.RESOLVED;
    this.props.resolvedAt = new Date();
  }
}