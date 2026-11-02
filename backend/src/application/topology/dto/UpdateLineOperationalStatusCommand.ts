import { LineStatus } from '../../../domain/topology/LineStatus';

export interface UpdateLineOperationalStatusCommand {
  operationalStatus: LineStatus;
  expectedVersion: number;
  reason?: string;
}