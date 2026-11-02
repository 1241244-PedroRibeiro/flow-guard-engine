import { UserRole } from '../../../domain/user/UserRole';

export interface CreateUserCommand {
  firstName: string;
  lastName: string;
  email: string;
  password: string;
  roles: UserRole[];
}