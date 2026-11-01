import { User } from '../../../domain/user/User';
import { UserRole } from '../../../domain/user/UserRole';
import { UserStatus } from '../../../domain/user/UserStatus';

export interface UserResponseDto {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  status: UserStatus;
  roles: UserRole[];
}

export function toUserResponseDto(user: User): UserResponseDto {
  return {
    id: user.id.value,
    firstName: user.name.firstName,
    lastName: user.name.lastName,
    email: user.email.value,
    status: user.status,
    roles: Array.from(user.roles),
  };
}