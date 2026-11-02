import { IUserRepository } from '../user/ports/IUserRepository';
import { IPasswordHasher } from '../user/ports/IPasswordHasher';
import { ITokenService } from '../user/ports/ITokenService';
import { LoginCommand } from './dto/LoginCommand';
import { RegisterCommand } from './dto/RegisterCommand';
import { LoginResponseDto } from './dto/LoginResponseDto';
import { toUserResponseDto, UserResponseDto } from '../user/dto/UserResponseDto';
import { Email } from '../../domain/common/Email';
import { UnauthorizedDomainException } from '../../domain/common/exceptions/UnauthorizedDomainException';
import { ForbiddenDomainException } from '../../domain/common/exceptions/ForbiddenDomainException';
import { ResourceConflictException } from '../../domain/common/exceptions/ResourceConflictException';
import { User } from '../../domain/user/User';

export class AuthService {
  constructor(
    private readonly userRepository: IUserRepository,
    private readonly passwordHasher: IPasswordHasher,
    private readonly tokenService: ITokenService,
  ) {}

  async login(command: LoginCommand): Promise<LoginResponseDto> {
    if (!command.email || !command.password) {
      throw new UnauthorizedDomainException('Email and password are required');
    }

    const emailVo = Email.create(command.email);
    const user = await this.userRepository.findByEmail(emailVo);

    if (!user) {
      throw new UnauthorizedDomainException('Invalid email or password');
    }

    const isPasswordValid = await this.passwordHasher.verify(user.passwordHash, command.password);
    if (!isPasswordValid) {
      throw new UnauthorizedDomainException('Invalid email or password');
    }

    if (!user.isActive()) {
      throw new ForbiddenDomainException('User account is not active');
    }

    const accessToken = this.tokenService.sign({
      sub: user.id.value,
      email: user.email.value,
      roles: Array.from(user.roles),
    });

    return {
      accessToken,
      tokenType: 'Bearer',
      expiresIn: 28800,
      user: toUserResponseDto(user),
    };
  }

  async register(command: RegisterCommand): Promise<UserResponseDto> {
    const emailVo = Email.create(command.email);

    const exists = await this.userRepository.existsByEmail(emailVo);
    if (exists) {
      throw new ResourceConflictException('Email already registered');
    }

    const passwordHash = await this.passwordHasher.hash(command.password);

    const user = User.register({
      firstName: command.firstName,
      lastName: command.lastName,
      email: emailVo.value,
      passwordHash,
    });

    await this.userRepository.save(user);
    return toUserResponseDto(user);
  }
}