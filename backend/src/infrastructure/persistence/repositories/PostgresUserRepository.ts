import { Pool } from 'pg';
import { IUserRepository, ListUserFilters, PaginationParams } from '../../../application/user/ports/IUserRepository';
import { User } from '../../../domain/user/User';
import { Email } from '../../../domain/common/Email';
import { UserId } from '../../../domain/user/UserId';
import { UserMapper, UserRow } from '../mappers/UserMapper';

export class PostgresUserRepository implements IUserRepository {
  constructor(private readonly pool: Pool) {}

  async findById(id: UserId): Promise<User | null> {
    const { rows } = await this.pool.query<UserRow>(
      `SELECT u.*, COALESCE(array_agg(ur.role) FILTER (WHERE ur.role IS NOT NULL), '{}') as roles
       FROM users u
       LEFT JOIN user_roles ur ON u.id = ur.user_id
       WHERE u.id = $1
       GROUP BY u.id`,
      [id.value],
    );
    return rows.length ? UserMapper.toDomain(rows[0]) : null;
  }

  async findByEmail(email: Email): Promise<User | null> {
    const { rows } = await this.pool.query<UserRow>(
      `SELECT u.*, COALESCE(array_agg(ur.role) FILTER (WHERE ur.role IS NOT NULL), '{}') as roles
       FROM users u
       LEFT JOIN user_roles ur ON u.id = ur.user_id
       WHERE LOWER(u.email) = $1
       GROUP BY u.id`,
      [email.value],
    );
    return rows.length ? UserMapper.toDomain(rows[0]) : null;
  }

  async existsByEmail(email: Email): Promise<boolean> {
    const { rowCount } = await this.pool.query(
      'SELECT 1 FROM users WHERE LOWER(email) = $1',
      [email.value],
    );
    return (rowCount ?? 0) > 0;
  }

  async save(user: User): Promise<void> {
    const { userRow, roles } = UserMapper.toPersistence(user);
    const client = await this.pool.connect();

    try {
      await client.query('BEGIN');

      // Upsert do utilizador
      await client.query(
        `INSERT INTO users (id, first_name, last_name, email, password_hash, status)
         VALUES ($1, $2, $3, $4, $5, $6)
         ON CONFLICT (id) DO UPDATE SET
           first_name = EXCLUDED.first_name,
           last_name = EXCLUDED.last_name,
           email = EXCLUDED.email,
           password_hash = EXCLUDED.password_hash,
           status = EXCLUDED.status,
           updated_at = NOW()`,
        [userRow.id, userRow.first_name, userRow.last_name, userRow.email, userRow.password_hash, userRow.status],
      );

      // Atualizar roles (apaga os antigos e insere os novos)
      await client.query('DELETE FROM user_roles WHERE user_id = $1', [userRow.id]);
      
      for (const role of roles) {
        await client.query(
          'INSERT INTO user_roles (user_id, role) VALUES ($1, $2)',
          [userRow.id, role],
        );
      }

      await client.query('COMMIT');
    } catch (error) {
      await client.query('ROLLBACK');
      throw error; // O GlobalExceptionFilter (ou o repositório) apanha o erro 23505 se for email duplicado
    } finally {
      client.release();
    }
  }

  async list(filters: ListUserFilters, pagination: PaginationParams): Promise<{ users: User[]; total: number }> {
    const offset = (pagination.page - 1) * pagination.pageSize;
    const values: any[] = [];
    let whereClause = '';
    
    if (filters.role) {
      values.push(filters.role);
      whereClause += ` AND EXISTS (SELECT 1 FROM user_roles ur2 WHERE ur2.user_id = u.id AND ur2.role = $${values.length})`;
    }
    if (filters.status) {
      values.push(filters.status);
      whereClause += ` AND u.status = $${values.length}`;
    }

    const countRes = await this.pool.query(
      `SELECT COUNT(*) FROM users u WHERE 1=1 ${whereClause}`,
      values,
    );
    
    values.push(pagination.pageSize, offset);
    
    const { rows } = await this.pool.query<UserRow>(
      `SELECT u.*, COALESCE(array_agg(ur.role) FILTER (WHERE ur.role IS NOT NULL), '{}') as roles
       FROM users u
       LEFT JOIN user_roles ur ON u.id = ur.user_id
       WHERE 1=1 ${whereClause}
       GROUP BY u.id
       ORDER BY u.created_at DESC
       LIMIT $${values.length - 1} OFFSET $${values.length}`,
      values,
    );

    return {
      users: rows.map(UserMapper.toDomain),
      total: parseInt(countRes.rows[0].count, 10),
    };
  }
}