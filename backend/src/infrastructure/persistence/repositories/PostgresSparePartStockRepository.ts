import { Pool } from 'pg';
import { ISparePartStockRepository, MovementType } from '../../../application/stock/ports/ISparePartStockRepository';
import { SparePartStock } from '../../../domain/stock/SparePartStock';
import { AbstractStockQuantity } from '../../../domain/common/AbstractStockQuantity';
import { EntityNotFoundException } from '../../../domain/common/exceptions/EntityNotFoundException';
import { SparePartStockMapper, SparePartStockRow } from '../mappers/SparePartStockMapper';
import { randomUUID } from 'node:crypto';

export class PostgresSparePartStockRepository implements ISparePartStockRepository {
  constructor(private readonly pool: Pool) {}

  async findById(id: string): Promise<SparePartStock | null> {
    const { rows } = await this.pool.query<SparePartStockRow>(
      `SELECT * FROM spare_part_stock WHERE id = $1`,
      [id],
    );
    return rows.length === 0 ? null : SparePartStockMapper.toDomain(rows[0]);
  }

  async findByPartCode(partCode: string): Promise<SparePartStock | null> {
    const { rows } = await this.pool.query<SparePartStockRow>(
      `SELECT * FROM spare_part_stock WHERE UPPER(part_code) = UPPER($1)`,
      [partCode],
    );
    return rows.length === 0 ? null : SparePartStockMapper.toDomain(rows[0]);
  }

  async findAll(): Promise<SparePartStock[]> {
    const { rows } = await this.pool.query<SparePartStockRow>(
      `SELECT * FROM spare_part_stock ORDER BY part_code ASC`,
    );
    return rows.map(SparePartStockMapper.toDomain);
  }

  async save(part: SparePartStock): Promise<void> {
    const p = SparePartStockMapper.toPersistence(part);
    await this.pool.query(
      `INSERT INTO spare_part_stock (id, part_code, name, stock_units, updated_at)
       VALUES ($1, $2, $3, $4, $5)`,
      [p.id, p.part_code, p.name, p.stock_units, p.updated_at],
    );
  }

  async adjustStockWithLock(
    partId: string,
    type: MovementType,
    units: number,
    reason: string,
    userId: string,
  ): Promise<SparePartStock> {
    const client = await this.pool.connect();
    try {
      await client.query('BEGIN');

      // 1. Pessimistic Row-Level Lock (KB §23.1)
      const { rows } = await client.query<SparePartStockRow>(
        `SELECT * FROM spare_part_stock WHERE id = $1 FOR UPDATE`,
        [partId],
      );

      if (rows.length === 0) {
        throw new EntityNotFoundException(`SparePartStock ${partId} not found.`);
      }

      const part = SparePartStockMapper.toDomain(rows[0]);
      const amount = AbstractStockQuantity.create(units);

      // 2. Domain Mutation (Throws DomainInvariantException if consume > stock)
      if (type === 'REPLENISHMENT') {
        part.replenish(amount);
      } else {
        part.consume(amount);
      }

      // 3. Update Balance
      const p = SparePartStockMapper.toPersistence(part);
      await client.query(
        `UPDATE spare_part_stock SET stock_units = $2, updated_at = NOW() WHERE id = $1`,
        [p.id, p.stock_units],
      );

      // 4. Insert Audit Movement (AC3)
      await client.query(
        `INSERT INTO spare_part_movements
           (id, part_id, movement_type, amount, reason, performed_by, recorded_at)
         VALUES ($1, $2, $3, $4, $5, $6, NOW())`,
        [randomUUID(), part.id, type, units, reason, userId],
      );

      await client.query('COMMIT');
      return part;
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }
  }
}