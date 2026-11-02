import { IUserRepository, ListUserFilters, PaginationParams } from '../../../src/application/user/ports/IUserRepository';
import { User } from '../../../src/domain/user/User';
import { Email } from '../../../src/domain/common/Email';
import { UserId } from '../../../src/domain/user/UserId';
import { UserRole } from '../../../src/domain/user/UserRole';

export class InMemoryUserRepository implements IUserRepository {
  private readonly users = new Map<string, User>();

  async findById(id: UserId): Promise<User | null> {
    return this.users.get(id.value) ?? null;
  }

  async findByEmail(email: Email): Promise<User | null> {
    for (const user of this.users.values()) {
      if (user.email.value === email.value) return user;
    }
    return null;
  }

  async existsByEmail(email: Email): Promise<boolean> {
    return (await this.findByEmail(email)) !== null;
  }

  async save(user: User): Promise<void> {
    this.users.set(user.id.value, user);
  }

  async list(
    filters: ListUserFilters,
    pagination: PaginationParams,
  ): Promise<{ users: User[]; total: number }> {
    let result = Array.from(this.users.values());

    if (filters.role) {
      result = result.filter((u) => u.hasRole(filters.role as UserRole));
    }
    if (filters.status) {
      result = result.filter((u) => u.status === filters.status);
    }

    const total = result.length;
    const start = (pagination.page - 1) * pagination.pageSize;
    const paginated = result.slice(start, start + pagination.pageSize);

    return { users: paginated, total };
  }
}