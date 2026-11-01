import { AuthService } from '../../../src/application/auth/AuthService';
import { InMemoryUserRepository } from '../../helpers/fakes/InMemoryUserRepository';
import { FakePasswordHasher } from '../../helpers/fakes/FakePasswordHasher';
import { FakeTokenService } from '../../helpers/fakes/FakeTokenService';
import { User } from '../../../src/domain/user/User';
import { UserRole } from '../../../src/domain/user/UserRole';
import { UserStatus } from '../../../src/domain/user/UserStatus';
import { UnauthorizedDomainException } from '../../../src/domain/common/exceptions/UnauthorizedDomainException';
import { ForbiddenDomainException } from '../../../src/domain/common/exceptions/ForbiddenDomainException';
import { ResourceConflictException } from '../../../src/domain/common/exceptions/ResourceConflictException';

describe('AuthService', () => {
  let authService: AuthService;
  let userRepo: InMemoryUserRepository;
  let hasher: FakePasswordHasher;
  let tokenService: FakeTokenService;

  beforeEach(() => {
    userRepo = new InMemoryUserRepository();
    hasher = new FakePasswordHasher();
    tokenService = new FakeTokenService();
    authService = new AuthService(userRepo, hasher, tokenService);
  });

  describe('register()', () => {
    it('creates a PENDING_REGISTRATION user with OPERATOR role', async () => {
      const dto = await authService.register({
        firstName: 'Ana', lastName: 'Silva',
        email: 'ana@example.com', password: 'Password123!',
      });

      expect(dto.id).toBeDefined();
      expect(dto.email).toBe('ana@example.com');
      expect(dto.status).toBe(UserStatus.PENDING_REGISTRATION);
      expect(dto.roles).toEqual([UserRole.OPERATOR]);
      expect((dto as any).passwordHash).toBeUndefined();
    });

    it('rejects duplicate emails (case-insensitive)', async () => {
      await authService.register({
        firstName: 'Ana', lastName: 'Silva',
        email: 'ana@example.com', password: 'Password123!',
      });

      await expect(
        authService.register({
          firstName: 'Ana', lastName: 'Silva',
          email: 'ANA@example.com', password: 'Password123!',
        }),
      ).rejects.toThrow(ResourceConflictException);
    });
  });

  describe('login()', () => {
    beforeEach(async () => {
      const hash = await hasher.hash('Password123!');
      const user = User.create({
        firstName: 'Eng', lastName: 'Ribeiro',
        email: 'eng@flowguard.industrial', passwordHash: hash,
        roles: [UserRole.ENGINEER],
      });
      await userRepo.save(user);
    });

    it('returns a JWT and user details on valid credentials', async () => {
      const response = await authService.login({
        email: 'eng@flowguard.industrial',
        password: 'Password123!',
      });

      expect(response.accessToken).toMatch(/^fake-token-/);
      expect(response.tokenType).toBe('Bearer');
      expect(response.expiresIn).toBe(28800);
      expect(response.user.email).toBe('eng@flowguard.industrial');
      expect(response.user.roles).toEqual([UserRole.ENGINEER]);
      expect((response.user as any).passwordHash).toBeUndefined();
    });

    it('throws UnauthorizedDomainException for non-existent email', async () => {
      await expect(
        authService.login({ email: 'unknown@example.com', password: 'Password123!' }),
      ).rejects.toThrow(UnauthorizedDomainException);
    });

    it('throws UnauthorizedDomainException for wrong password', async () => {
      await expect(
        authService.login({ email: 'eng@flowguard.industrial', password: 'WrongPassword!' }),
      ).rejects.toThrow(UnauthorizedDomainException);
    });

    it('throws ForbiddenDomainException if user is PENDING_REGISTRATION', async () => {
      const hash = await hasher.hash('Password123!');
      const pendingUser = User.register({
        firstName: 'Pending', lastName: 'User',
        email: 'pending@example.com', passwordHash: hash,
      });
      await userRepo.save(pendingUser);

      await expect(
        authService.login({ email: 'pending@example.com', password: 'Password123!' }),
      ).rejects.toThrow(ForbiddenDomainException);
    });
  });
});