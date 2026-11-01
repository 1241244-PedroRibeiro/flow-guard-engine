import { IUserRepository, ListUserFilters, PaginationParams } from './ports/IUserRepository';
import { IPasswordHasher } from './ports/IPasswordHasher';
import { CreateUserCommand } from './dto/CreateUserCommand';
import { UpdateUserStatusCommand } from './dto/UpdateUserStatusCommand';
import { UpdateUserRolesCommand } from './dto/UpdateUserRolesCommand';
import { UserResponseDto, toUserResponseDto } from './dto/UserResponseDto';
import { User } from '../../domain/user/User';
import { Email } from '../../domain/common/Email';
import { UserId } from '../../domain/user/UserId';
import { UserStatus } from '../../domain/user/UserStatus';
import { ResourceConflictException } from '../../domain/common/exceptions/ResourceConflictException';
import { EntityNotFoundException } from '../../domain/common/exceptions/EntityNotFoundException';
import { DomainInvariantException } from '../../domain/common/exceptions/DomainInvariantException';

export class UserService {
  constructor(
    private readonly userRepository: IUserRepository,
    private readonly passwordHasher: IPasswordHasher,
  ) {}

  async createUser(command: CreateUserCommand): Promise<UserResponseDto> {
    const emailVo = Email.create(command.email);

    const exists = await this.userRepository.existsByEmail(emailVo);
    if (exists) {
      throw new ResourceConflictException('Email already registered');
    }

    const passwordHash = await this.passwordHasher.hash(command.password);

    const user = User.create({
      firstName: command.firstName,
      lastName: command.lastName,
      email: emailVo.value,
      passwordHash,
      roles: command.roles,
    });

    await this.userRepository.save(user);
    return toUserResponseDto(user);
  }

  async listUsers(
    filters: ListUserFilters,
    pagination: PaginationParams,
  ): Promise<{ users: UserResponseDto[]; total: number }> {
    const { users, total } = await this.userRepository.list(filters, pagination);
    return {
      users: users.map(toUserResponseDto),
      total,
    };
  }

  async updateStatus(userId: string, command: UpdateUserStatusCommand): Promise<UserResponseDto> {
    const id = UserId.create(userId);
    const user = await this.userRepository.findById(id);

    if (!user) {
      throw new EntityNotFoundException('User not found');
    }

    if (command.status === UserStatus.ACTIVE) {
      user.activate();
    } else if (command.status === UserStatus.DEACTIVATED) {
      user.deactivate();
    } else {
      throw new DomainInvariantException(`Cannot transition status to ${command.status}`);
    }

    await this.userRepository.save(user);
    return toUserResponseDto(user);
  }

  async updateRoles(userId: string, command: UpdateUserRolesCommand): Promise<UserResponseDto> {
    const id = UserId.create(userId);
    const user = await this.userRepository.findById(id);

    if (!user) {
      throw new EntityNotFoundException('User not found');
    }

    user.replaceRoles(command.roles);
    await this.userRepository.save(user);
    return toUserResponseDto(user);
  }
}