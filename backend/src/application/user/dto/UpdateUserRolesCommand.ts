import { UserRole } from '../../../domain/user/UserRole';

export interface UpdateUserRolesCommand {
  roles: UserRole[];
}