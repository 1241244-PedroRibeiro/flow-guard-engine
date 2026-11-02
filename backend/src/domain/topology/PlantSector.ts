import { randomUUID } from 'node:crypto';
import { DomainError } from '../common/exceptions/DomainError';
import { SectorCode } from '../common/SectorCode';
import { Designation } from '../common/Designation';

interface CreateSectorParams {
  sectorCode: string;
  name: string;
  description?: string;
}

interface ReconstituteSectorParams {
  id: string;
  sectorCode: string;
  name: string;
  description: string | null;
  isActive: boolean;
}

export class PlantSector {
  private constructor(
    private readonly _id: string,
    private readonly _sectorCode: SectorCode,
    private _name: Designation,
    private _description: string | null,
    private _isActive: boolean,
  ) {}

  static create(params: CreateSectorParams): PlantSector {
    return new PlantSector(
      randomUUID(),
      SectorCode.create(params.sectorCode),
      Designation.create(params.name, 120),
      params.description?.trim() || null,
      true,
    );
  }

  static reconstitute(params: ReconstituteSectorParams): PlantSector {
    return new PlantSector(
      params.id,
      SectorCode.create(params.sectorCode),
      Designation.create(params.name, 120),
      params.description,
      params.isActive,
    );
  }

  get id(): string { return this._id; }
  get sectorCode(): SectorCode { return this._sectorCode; }
  get name(): Designation { return this._name; }
  get description(): string | null { return this._description; }
  get isActive(): boolean { return this._isActive; }

  updateDetails(name: string, description?: string): void {
    this._name = Designation.create(name, 120);
    this._description = description?.trim() || null;
  }

  activate(): void {
    this._isActive = true;
  }

  deactivate(): void {
    this._isActive = false;
  }
}