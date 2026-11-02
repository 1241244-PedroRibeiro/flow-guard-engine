import { User } from '../../../domain/user/User';
import { UserRole } from '../../../domain/user/UserRole';
import { UserStatus } from '../../../domain/user/UserStatus';
import { PasswordHash } from '../../../domain/common/PasswordHash';

export interface UserRow {
  id: string;
  first_name: string;
  last_name: string;
  email: string;
  password_hash: string;
  status: string;
  roles: string[]; // Vem do array_agg do SQL
}

export class UserMapper {
  static toDomain(row: UserRow): User {
    return User.reconstitute({
      id: row.id,
      firstName: row.first_name,
      lastName: row.last_name,
      email: row.email,
      passwordHash: row.password_hash,
      status: row.status as UserStatus,
      roles: row.roles as UserRole[],
    });
  }

  static toPersistence(user: User): { userRow: any; roles: UserRole[] } {
    return {
      userRow: {
        id: user.id.value,
        first_name: user.name.firstName,
        last_name: user.name.lastName,
        email: user.email.value,
        password_hash: user.passwordHash.value,
        status: user.status,
      },
      roles: Array.from(user.roles),
    };
  }
}