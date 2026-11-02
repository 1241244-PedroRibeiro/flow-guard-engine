import { UserService } from '../../../src/application/user/UserService';
import { InMemoryUserRepository } from '../../helpers/fakes/InMemoryUserRepository';
import { FakePasswordHasher } from '../../helpers/fakes/FakePasswordHasher';
import { UserRole } from '../../../src/domain/user/UserRole';
import { UserStatus } from '../../../src/domain/user/UserStatus';
import { EntityNotFoundException } from '../../../src/domain/common/exceptions/EntityNotFoundException';

describe('UserService', () => {
  let userService: UserService;
  let userRepo: InMemoryUserRepository;
  let hasher: FakePasswordHasher;

  beforeEach(() => {
    userRepo = new InMemoryUserRepository();
    hasher = new FakePasswordHasher();
    userService = new UserService(userRepo, hasher);
  });

  describe('createUser()', () => {
    it('creates an ACTIVE user with the given roles', async () => {
      const dto = await userService.createUser({
        firstName: 'Admin', lastName: 'Istrator',
        email: 'admin@example.com', password: 'Admin123!',
        roles: [UserRole.ADMINISTRATOR, UserRole.ENGINEER],
      });

      expect(dto.id).toBeDefined();
      expect(dto.status).toBe(UserStatus.ACTIVE);
      expect(dto.roles).toEqual(expect.arrayContaining([UserRole.ADMINISTRATOR, UserRole.ENGINEER]));
    });
  });

  describe('updateStatus()', () => {
    it('deactivates an ACTIVE user', async () => {
      const created = await userService.createUser({
        firstName: 'A', lastName: 'B', email: 'a@b.co', password: 'Password123!', roles: [UserRole.OPERATOR],
      });

      const updated = await userService.updateStatus(created.id, { status: UserStatus.DEACTIVATED });
      expect(updated.status).toBe(UserStatus.DEACTIVATED);
    });

    it('throws EntityNotFoundException for unknown user', async () => {
      await expect(
        userService.updateStatus('11111111-1111-4111-8111-111111111101', { status: UserStatus.ACTIVE }),
      ).rejects.toThrow(EntityNotFoundException);
    });
  });

  describe('updateRoles()', () => {
    it('replaces the roles', async () => {
      const created = await userService.createUser({
        firstName: 'A', lastName: 'B', email: 'a@b.co', password: 'Password123!', roles: [UserRole.OPERATOR],
      });

      const updated = await userService.updateRoles(created.id, { roles: [UserRole.ENGINEER] });
      expect(updated.roles).toEqual([UserRole.ENGINEER]);
    });
  });
});