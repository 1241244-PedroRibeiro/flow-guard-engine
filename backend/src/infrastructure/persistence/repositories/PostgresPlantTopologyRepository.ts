import { Pool } from 'pg';
import { IPlantTopologyRepository, ConveyorLineHealthSummary } from '../../../application/topology/ports/IPlantTopologyRepository';
import { PlantSector } from '../../../domain/topology/PlantSector';
import { ConveyorLine } from '../../../domain/topology/ConveyorLine';
import { PlantSectorMapper, PlantSectorRow } from '../mappers/PlantSectorMapper';
import { ConveyorLineMapper, ConveyorLineRow } from '../mappers/ConveyorLineMapper';
import { ResourceConflictException } from '../../../domain/common/exceptions/ResourceConflictException';
import { OptimisticConcurrencyConflictException } from '../../../domain/common/exceptions/OptimisticConcurrencyConflictException';

export class PostgresPlantTopologyRepository implements IPlantTopologyRepository {
  constructor(private readonly pool: Pool) {}

  // ================= SECTORS =================

  async findAllSectors(isActive?: boolean): Promise<PlantSector[]> {
    let query = 'SELECT * FROM plant_sectors';
    const values: any[] = [];
    
    if (isActive !== undefined) {
      query += ' WHERE is_active = $1';
      values.push(isActive);
    }
    query += ' ORDER BY sector_code ASC';

    const { rows } = await this.pool.query<PlantSectorRow>(query, values);
    return rows.map(PlantSectorMapper.toDomain);
  }

  async findSectorById(id: string): Promise<PlantSector | null> {
    const { rows } = await this.pool.query<PlantSectorRow>('SELECT * FROM plant_sectors WHERE id = $1', [id]);
    return rows.length ? PlantSectorMapper.toDomain(rows[0]) : null;
  }

  async saveSector(sector: PlantSector): Promise<void> {
    const row = PlantSectorMapper.toPersistence(sector);
    try {
      await this.pool.query(
        `INSERT INTO plant_sectors (id, sector_code, name, description, is_active)
         VALUES ($1, $2, $3, $4, $5)
         ON CONFLICT (id) DO UPDATE SET
           name = EXCLUDED.name,
           description = EXCLUDED.description,
           is_active = EXCLUDED.is_active,
           updated_at = NOW()`,
        [row.id, row.sector_code, row.name, row.description, row.is_active]
      );
    } catch (err: any) {
      if (err.code === '23505') throw new ResourceConflictException('Sector code already exists');
      throw err;
    }
  }

  async deleteSector(id: string): Promise<void> {
    try {
      await this.pool.query('DELETE FROM plant_sectors WHERE id = $1', [id]);
    } catch (err: any) {
      if (err.code === '23503') throw new ResourceConflictException('Cannot delete PlantSector: referenced by conveyor lines');
      throw err;
    }
  }

  // ================= CONVEYOR LINES =================

  async findLineById(id: string): Promise<ConveyorLine | null> {
    const { rows } = await this.pool.query<ConveyorLineRow>('SELECT * FROM conveyor_lines WHERE id = $1', [id]);
    return rows.length ? ConveyorLineMapper.toDomain(rows[0]) : null;
  }

  async saveLine(line: ConveyorLine): Promise<void> {
    const row = ConveyorLineMapper.toPersistence(line);
    try {
      const existing = await this.findLineById(line.id);
      
      if (!existing) {
        await this.pool.query(
          `INSERT INTO conveyor_lines (id, sector_id, line_code, name, operational_status, is_active, version)
           VALUES ($1, $2, $3, $4, $5, $6, $7)`,
          [row.id, row.sector_id, row.line_code, row.name, row.operational_status, row.is_active, row.version]
        );
      } else {
        const result = await this.pool.query(
          `UPDATE conveyor_lines 
           SET operational_status = $1, is_active = $2, version = version + 1, updated_at = NOW()
           WHERE id = $3 AND version = $4`,
          [row.operational_status, row.is_active, row.id, row.version - 1]
        );
        if (result.rowCount === 0) {
          throw new OptimisticConcurrencyConflictException('ConveyorLine was modified by another transaction');
        }
      }
    } catch (err: any) {
      if (err.code === '23505') throw new ResourceConflictException('Line code already exists');
      if (err.code === '23503') throw new ResourceConflictException('Referenced sector does not exist');
      throw err;
    }
  }

  async deleteLine(id: string): Promise<void> {
    try {
      await this.pool.query('DELETE FROM conveyor_lines WHERE id = $1', [id]);
    } catch (err: any) {
      if (err.code === '23503') throw new ResourceConflictException('Cannot delete ConveyorLine: referenced by sensors or alerts');
      throw err;
    }
  }

  // ================= CQRS READ VIEW =================

  async findLineHealthSummaries(filters: { sectorId?: string; operationalStatus?: string }): Promise<ConveyorLineHealthSummary[]> {
    let query = 'SELECT * FROM v_conveyor_line_health_summary WHERE 1=1';
    const values: any[] = [];

    if (filters.sectorId) {
      values.push(filters.sectorId);
      query += ` AND sector_id = $${values.length}`;
    }
    if (filters.operationalStatus) {
      values.push(filters.operationalStatus);
      query += ` AND operational_status = $${values.length}`;
    }
    query += ' ORDER BY line_code ASC';

    const { rows } = await this.pool.query(query, values);
    return rows.map(this.mapToHealthSummary);
  }

  async findLineHealthSummaryById(id: string): Promise<ConveyorLineHealthSummary | null> {
    const { rows } = await this.pool.query('SELECT * FROM v_conveyor_line_health_summary WHERE id = $1', [id]);
    return rows.length ? this.mapToHealthSummary(rows[0]) : null;
  }

  private mapToHealthSummary(r: any): ConveyorLineHealthSummary {
    return {
      id: r.id,
      sectorId: r.sector_id,
      sectorCode: r.sector_code,
      lineCode: r.line_code,
      name: r.name,
      operationalStatus: r.operational_status,
      isActive: r.is_active,
      version: r.version,
      activeSensorCount: r.active_sensor_count,
      openWarningAlertCount: r.open_warning_alert_count,
      openCriticalAlertCount: r.open_critical_alert_count,
      updatedAt: r.updated_at.toISOString(),
    };
  }
}