import { randomUUID } from 'node:crypto';
import { DomainError } from '../common/exceptions/DomainError';
import { LineCode } from '../common/LineCode';
import { Designation } from '../common/Designation';
import { LineStatus } from './LineStatus';
import { OptimisticConcurrencyConflictException } from '../common/exceptions/OptimisticConcurrencyConflictException';

interface CreateLineParams {
  sectorId: string;
  lineCode: string;
  name: string;
}

interface ReconstituteLineParams {
  id: string;
  sectorId: string;
  lineCode: string;
  name: string;
  operationalStatus: LineStatus;
  isActive: boolean;
  version: number;
}

export class ConveyorLine {
  private constructor(
    private readonly _id: string,
    private readonly _sectorId: string,
    private readonly _lineCode: LineCode,
    private _name: Designation,
    private _operationalStatus: LineStatus,
    private _isActive: boolean,
    private _version: number,
  ) {
    this.validateConsistency();
  }

  static create(params: CreateLineParams): ConveyorLine {
    return new ConveyorLine(
      randomUUID(),
      params.sectorId,
      LineCode.create(params.lineCode),
      Designation.create(params.name, 150),
      LineStatus.RUNNING,
      true,
      1,
    );
  }

  static reconstitute(params: ReconstituteLineParams): ConveyorLine {
    return new ConveyorLine(
      params.id,
      params.sectorId,
      LineCode.create(params.lineCode),
      Designation.create(params.name, 150),
      params.operationalStatus,
      params.isActive,
      params.version,
    );
  }

  // Getters
  get id(): string { return this._id; }
  get sectorId(): string { return this._sectorId; }
  get lineCode(): LineCode { return this._lineCode; }
  get name(): Designation { return this._name; }
  get operationalStatus(): LineStatus { return this._operationalStatus; }
  get isActive(): boolean { return this._isActive; }
  get version(): number { return this._version; }

  // Rich Behaviour
  updateStatus(newStatus: LineStatus, expectedVersion?: number): void {
    if (expectedVersion !== undefined && expectedVersion !== this._version) {
      throw new OptimisticConcurrencyConflictException('Optimistic concurrency conflict: version mismatch');
    }
    if (!Object.values(LineStatus).includes(newStatus)) {
      throw new DomainError(`Invalid line status: ${newStatus}`);
    }

    this._operationalStatus = newStatus;
    if (newStatus === LineStatus.DEACTIVATED) {
      this._isActive = false;
    } else {
      this._isActive = true;
    }
    this._version += 1;
    this.validateConsistency();
  }

  activate(): void {
    if (this._isActive) return;
    this._isActive = true;
    this._operationalStatus = LineStatus.RUNNING;
    this._version += 1;
  }

  deactivate(): void {
    if (!this._isActive) return;
    this._isActive = false;
    this._operationalStatus = LineStatus.DEACTIVATED;
    this._version += 1;
  }

  private validateConsistency(): void {
    if (!this._isActive && this._operationalStatus !== LineStatus.DEACTIVATED) {
      throw new DomainError('Inactive line must have DEACTIVATED status');
    }
    if (this._isActive && this._operationalStatus === LineStatus.DEACTIVATED) {
      throw new DomainError('Active line cannot have DEACTIVATED status');
    }
  }
}