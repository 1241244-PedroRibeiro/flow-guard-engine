export interface AcknowledgeAlertCommand {
  alertId: string;
  userId: string;
  diagnosticNote: string;
}