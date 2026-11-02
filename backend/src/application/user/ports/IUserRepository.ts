import { User } from '../../../domain/user/User';
import { Email } from '../../../domain/common/Email';
import { UserId } from '../../../domain/user/UserId';

export interface ListUserFilters {
  role?: string;
  status?: string;
}

export interface PaginationParams {
  page: number;
  pageSize: number;
}

export interface IUserRepository {
  findById(id: UserId): Promise<User | null>;
  findByEmail(email: Email): Promise<User | null>;
  existsByEmail(email: Email): Promise<boolean>;
  save(user: User): Promise<void>;
  list(
    filters: ListUserFilters,
    pagination: PaginationParams,
  ): Promise<{ users: User[]; total: number }>;
}