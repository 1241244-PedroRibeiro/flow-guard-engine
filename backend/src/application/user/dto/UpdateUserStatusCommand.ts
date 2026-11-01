import { UserStatus } from '../../../domain/user/UserStatus';

export interface UpdateUserStatusCommand {
  status: UserStatus;
}