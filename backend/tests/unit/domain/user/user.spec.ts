import { User } from '../../../../src/domain/user/User';
import { UserRole } from '../../../../src/domain/user/UserRole';
import { UserStatus } from '../../../../src/domain/user/UserStatus';
import { PasswordHash } from '../../../../src/domain/common/PasswordHash';
import { DomainError } from '../../../../src/domain/common/exceptions/DomainError';

const FAKE_HASH = PasswordHash.fromHash('$argon2id$v=19$m=65536,t=3,p=1$salt$hash');

describe('User Aggregate Root', () => {
  describe('register()', () => {
    it('forces PENDING_REGISTRATION status', () => {
      const user = User.register({
        firstName: 'Ana', lastName: 'Silva',
        email: 'ana@example.com', passwordHash: FAKE_HASH,
      });
      expect(user.status).toBe(UserStatus.PENDING_REGISTRATION);
      expect(user.isActive()).toBe(false);
    });

    it('forces exactly one OPERATOR role', () => {
      const user = User.register({
        firstName: 'Ana', lastName: 'Silva',
        email: 'ana@example.com', passwordHash: FAKE_HASH,
      });
      expect(user.roles.size).toBe(1);
      expect(user.hasRole(UserRole.OPERATOR)).toBe(true);
    });

    it('generates a fresh UserId', () => {
      const a = User.register({ firstName: 'A', lastName: 'B', email: 'a@b.co', passwordHash: FAKE_HASH });
      const b = User.register({ firstName: 'A', lastName: 'B', email: 'a@b.co', passwordHash: FAKE_HASH });
      expect(a.id.equals(b.id)).toBe(false);
    });
  });

  describe('create()', () => {
    it('starts ACTIVE with the given roles', () => {
      const user = User.create({
        firstName: 'Eng', lastName: 'Ribeiro',
        email: 'eng@flowguard.industrial', passwordHash: FAKE_HASH,
        roles: [UserRole.ENGINEER],
      });
      expect(user.status).toBe(UserStatus.ACTIVE);
      expect(user.hasRole(UserRole.ENGINEER)).toBe(true);
    });

    it('rejects empty roles', () => {
      expect(() => User.create({
        firstName: 'Eng', lastName: 'Ribeiro',
        email: 'eng@flowguard.industrial', passwordHash: FAKE_HASH,
        roles: [],
      })).toThrow(DomainError);
    });

    it('rejects invalid role strings', () => {
      expect(() => User.create({
        firstName: 'A', lastName: 'B', email: 'a@b.co', passwordHash: FAKE_HASH,
        roles: ['ROOT' as UserRole],
      })).toThrow(DomainError);
    });

    it('deduplicates roles', () => {
      const user = User.create({
        firstName: 'Adm', lastName: 'In',
        email: 'adm@f.io', passwordHash: FAKE_HASH,
        roles: [UserRole.ADMINISTRATOR, UserRole.ADMINISTRATOR],
      });
      expect(user.roles.size).toBe(1);
    });
  });

  describe('changePassword()', () => {
    it('replaces the hash and exposes the new one', () => {
      const user = User.create({
        firstName: 'A', lastName: 'B', email: 'a@b.co', passwordHash: FAKE_HASH,
        roles: [UserRole.OPERATOR],
      });
      const newHash = PasswordHash.fromHash('$argon2id$v=19$m=65536,t=3,p=1$new$newhash');
      user.changePassword(newHash);
      expect(user.passwordHash).toBe(newHash);
    });
  });

  describe('assignRole()', () => {
    it('adds a new role', () => {
      const user = User.create({
        firstName: 'A', lastName: 'B', email: 'a@b.co', passwordHash: FAKE_HASH,
        roles: [UserRole.OPERATOR],
      });
      user.assignRole(UserRole.ENGINEER);
      expect(user.hasRole(UserRole.ENGINEER)).toBe(true);
      expect(user.roles.size).toBe(2);
    });

    it('is idempotent when the role is already held', () => {
      const user = User.create({
        firstName: 'A', lastName: 'B', email: 'a@b.co', passwordHash: FAKE_HASH,
        roles: [UserRole.OPERATOR],
      });
      user.assignRole(UserRole.OPERATOR);
      expect(user.roles.size).toBe(1);
    });

    it('rejects invalid role strings', () => {
      const user = User.create({
        firstName: 'A', lastName: 'B', email: 'a@b.co', passwordHash: FAKE_HASH,
        roles: [UserRole.OPERATOR],
      });
      expect(() => user.assignRole('SUPERUSER' as UserRole)).toThrow(DomainError);
    });
  });

  describe('revokeRole()', () => {
    it('throws if the target role is not held', () => {
      const user = User.create({
        firstName: 'A', lastName: 'B', email: 'a@b.co', passwordHash: FAKE_HASH,
        roles: [UserRole.OPERATOR],
      });
      expect(() => user.revokeRole(UserRole.ENGINEER)).toThrow(DomainError);
    });

    it('throws when revoking the last role', () => {
      const user = User.create({
        firstName: 'A', lastName: 'B', email: 'a@b.co', passwordHash: FAKE_HASH,
        roles: [UserRole.OPERATOR],
      });
      expect(() => user.revokeRole(UserRole.OPERATOR)).toThrow(DomainError);
    });

    it('removes the role when others remain', () => {
      const user = User.create({
        firstName: 'A', lastName: 'B', email: 'a@b.co', passwordHash: FAKE_HASH,
        roles: [UserRole.OPERATOR, UserRole.ENGINEER],
      });
      user.revokeRole(UserRole.OPERATOR);
      expect(user.hasRole(UserRole.OPERATOR)).toBe(false);
      expect(user.hasRole(UserRole.ENGINEER)).toBe(true);
    });
  });

  describe('replaceRoles()', () => {
    it('rejects empty list', () => {
      const user = User.create({
        firstName: 'A', lastName: 'B', email: 'a@b.co', passwordHash: FAKE_HASH,
        roles: [UserRole.OPERATOR],
      });
      expect(() => user.replaceRoles([])).toThrow(DomainError);
    });

    it('replaces the full role set', () => {
      const user = User.create({
        firstName: 'A', lastName: 'B', email: 'a@b.co', passwordHash: FAKE_HASH,
        roles: [UserRole.OPERATOR],
      });
      user.replaceRoles([UserRole.ENGINEER, UserRole.ADMINISTRATOR]);
      expect(user.hasRole(UserRole.OPERATOR)).toBe(false);
      expect(user.hasRole(UserRole.ENGINEER)).toBe(true);
      expect(user.hasRole(UserRole.ADMINISTRATOR)).toBe(true);
    });

    it('rejects invalid role strings inside the array', () => {
      const user = User.create({
        firstName: 'A', lastName: 'B', email: 'a@b.co', passwordHash: FAKE_HASH,
        roles: [UserRole.OPERATOR],
      });
      expect(() => user.replaceRoles(['SUPERUSER' as UserRole])).toThrow(DomainError);
    });
  });

  describe('lifecycle', () => {
    it('activate() transitions PENDING_REGISTRATION → ACTIVE', () => {
      const user = User.register({ firstName: 'A', lastName: 'B', email: 'a@b.co', passwordHash: FAKE_HASH });
      user.activate();
      expect(user.status).toBe(UserStatus.ACTIVE);
    });

    it('activate() is a no-op when already ACTIVE', () => {
      const user = User.create({
        firstName: 'A', lastName: 'B', email: 'a@b.co', passwordHash: FAKE_HASH,
        roles: [UserRole.OPERATOR],
      });
      user.activate();
      expect(user.status).toBe(UserStatus.ACTIVE);
    });

    it('deactivate() marks DEACTIVATED', () => {
      const user = User.create({
        firstName: 'A', lastName: 'B', email: 'a@b.co', passwordHash: FAKE_HASH,
        roles: [UserRole.OPERATOR],
      });
      user.deactivate();
      expect(user.status).toBe(UserStatus.DEACTIVATED);
      expect(user.isActive()).toBe(false);
    });

    it('deactivate() is a no-op when already DEACTIVATED', () => {
      const user = User.create({
        firstName: 'A', lastName: 'B', email: 'a@b.co', passwordHash: FAKE_HASH,
        roles: [UserRole.OPERATOR],
      });
      user.deactivate();
      user.deactivate();
      expect(user.status).toBe(UserStatus.DEACTIVATED);
    });
  });

  describe('equals()', () => {
    it('compares by identity (UserId)', () => {
      const a = User.create({
        firstName: 'A', lastName: 'B', email: 'a@b.co', passwordHash: FAKE_HASH,
        roles: [UserRole.OPERATOR],
      });
      const b = User.create({
        firstName: 'A', lastName: 'B', email: 'a@b.co', passwordHash: FAKE_HASH,
        roles: [UserRole.OPERATOR],
      });
      expect(a.equals(a)).toBe(true);
      expect(a.equals(b)).toBe(false);
    });
  });

  describe('reconstitute()', () => {
    it('rebuilds a valid aggregate', () => {
      const user = User.reconstitute({
        id: '11111111-1111-4111-8111-111111111101',
        firstName: 'System', lastName: 'Administrator',
        email: 'admin@flowguard.industrial',
        passwordHash: '$argon2id$v=19$m=65536,t=3,p=1$salt$hash',
        status: UserStatus.ACTIVE,
        roles: [UserRole.ADMINISTRATOR],
      });
      expect(user.hasRole(UserRole.ADMINISTRATOR)).toBe(true);
      expect(user.isActive()).toBe(true);
    });

    it('throws when persisted roles are empty (data integrity violation)', () => {
      expect(() => User.reconstitute({
        id: '11111111-1111-4111-8111-111111111101',
        firstName: 'Orphan', lastName: 'User',
        email: 'orphan@flowguard.industrial',
        passwordHash: '$argon2id$v=19$m=65536,t=3,p=1$salt$hash',
        status: UserStatus.ACTIVE,
        roles: [],
      })).toThrow(DomainError);
    });
  });
});