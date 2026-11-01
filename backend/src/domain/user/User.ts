import { DomainError } from '../common/exceptions/DomainError';
import { Email } from '../common/Email';
import { PersonName } from '../common/PersonName';
import { PasswordHash } from '../common/PasswordHash';
import { UserId } from './UserId';
import { UserRole } from './UserRole';
import { UserStatus } from './UserStatus';

interface RegisterUserParams {
  firstName: string;
  lastName: string;
  email: string;
  passwordHash: PasswordHash;
}

interface CreateUserParams extends RegisterUserParams {
  roles: UserRole[];
}

interface ReconstituteUserParams {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  passwordHash: string;
  status: UserStatus;
  roles: UserRole[];
}

export class User {
  private constructor(
    private readonly _id: UserId,
    private readonly _email: Email,
    private readonly _name: PersonName,
    private _passwordHash: PasswordHash,
    private _status: UserStatus,
    private readonly _roles: Set<UserRole>,
  ) {
    if (_roles.size === 0) {
      throw new DomainError('User must retain at least one role');
    }
  }

  /** Public self-registration: always OPERATOR + PENDING_REGISTRATION. */
  static register(params: RegisterUserParams): User {
    return new User(
      UserId.generate(),
      Email.create(params.email),
      PersonName.create(params.firstName, params.lastName),
      params.passwordHash,
      UserStatus.PENDING_REGISTRATION,
      new Set([UserRole.OPERATOR]),
    );
  }

  /** Admin provisioning: explicit roles, pre-activated account. */
  static create(params: CreateUserParams): User {
    if (!Array.isArray(params.roles) || params.roles.length === 0) {
      throw new DomainError('User must be assigned at least one role');
    }
    const uniqueRoles = new Set(params.roles);
    for (const role of uniqueRoles) {
      if (!Object.values(UserRole).includes(role)) {
        throw new DomainError(`Invalid role: ${role}`);
      }
    }
    return new User(
      UserId.generate(),
      Email.create(params.email),
      PersonName.create(params.firstName, params.lastName),
      params.passwordHash,
      UserStatus.ACTIVE,
      uniqueRoles,
    );
  }

  /** Reconstruction from persistence — used exclusively by UserMapper. */
  static reconstitute(params: ReconstituteUserParams): User {
    if (!Array.isArray(params.roles) || params.roles.length === 0) {
      throw new DomainError('Persisted User has no roles — data integrity violation');
    }
    const roleSet = new Set(params.roles);
    return new User(
      UserId.create(params.id),
      Email.create(params.email),
      PersonName.create(params.firstName, params.lastName),
      PasswordHash.fromHash(params.passwordHash),
      params.status,
      roleSet,
    );
  }

  // ----- Read accessors (no public setters) -----
  get id(): UserId { return this._id; }
  get email(): Email { return this._email; }
  get name(): PersonName { return this._name; }
  get passwordHash(): PasswordHash { return this._passwordHash; }
  get status(): UserStatus { return this._status; }
  get roles(): ReadonlySet<UserRole> { return new Set(this._roles); }

  // ----- Rich behaviour -----

  isActive(): boolean {
    return this._status === UserStatus.ACTIVE;
  }

  hasRole(role: UserRole): boolean {
    return this._roles.has(role);
  }

  activate(): void {
    if (this._status === UserStatus.ACTIVE) return;
    this._status = UserStatus.ACTIVE;
  }

  deactivate(): void {
    if (this._status === UserStatus.DEACTIVATED) return;
    this._status = UserStatus.DEACTIVATED;
  }

  changePassword(newHash: PasswordHash): void {
    this._passwordHash = newHash;
  }

  assignRole(role: UserRole): void {
    if (!Object.values(UserRole).includes(role)) {
      throw new DomainError(`Invalid role: ${role}`);
    }
    this._roles.add(role);
  }

  revokeRole(role: UserRole): void {
    if (!this._roles.has(role)) {
      throw new DomainError(`Cannot revoke role '${role}': user does not hold it`);
    }
    if (this._roles.size === 1) {
      throw new DomainError('Cannot revoke last role: user must retain at least one');
    }
    this._roles.delete(role);
  }

  replaceRoles(roles: UserRole[]): void {
    if (!Array.isArray(roles) || roles.length === 0) {
      throw new DomainError('User must be assigned at least one role');
    }
    const next = new Set(roles);
    for (const role of next) {
      if (!Object.values(UserRole).includes(role)) {
        throw new DomainError(`Invalid role: ${role}`);
      }
    }
    this._roles.clear();
    next.forEach((r) => this._roles.add(r));
  }

  equals(other: User): boolean {
    return other instanceof User && this._id.equals(other._id);
  }
}