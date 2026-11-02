import { Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { HealthController } from './http/controllers/HealthController';
import { AuthController } from './http/controllers/AuthController';
import { UserController } from './http/controllers/UserController';
import { AuthService } from '../application/auth/AuthService';
import { UserService } from '../application/user/UserService';
import { PostgresUserRepository } from '../infrastructure/persistence/repositories/PostgresUserRepository';
import { Argon2Hasher } from '../infrastructure/security/Argon2Hasher';
import { JwtTokenService } from '../infrastructure/security/JwtTokenService';
import { JwtAuthGuard } from './http/guards/JwtAuthGuard';
import { RolesGuard } from './http/guards/RolesGuard';
import { pool } from '../infrastructure/persistence/connection';
import { TopologyModule } from './topology.module';
import { SensorModule } from './sensor.module';
import { SecurityModule } from './security.module';
import { AlertModule } from './alert.module';


@Module({
  imports: [
    TopologyModule, // <-- Adicionado aqui
    SensorModule, // <-- Adicionado aqui
    SecurityModule, // <-- Adicionado aqui
    AlertModule, // <-- Adicionado aqui
  ],
  controllers: [HealthController, AuthController, UserController],
  providers: [
    {
      provide: APP_GUARD,
      useClass: JwtAuthGuard,
    },
    {
      provide: APP_GUARD,
      useClass: RolesGuard,
    },
    {
      provide: AuthService,
      useFactory: (repo, hasher, token) => new AuthService(repo, hasher, token),
      inject: ['IUserRepository', 'IPasswordHasher', 'ITokenService'],
    },
    {
      provide: UserService,
      useFactory: (repo, hasher) => new UserService(repo, hasher),
      inject: ['IUserRepository', 'IPasswordHasher'],
    },
    {
      provide: 'IUserRepository',
      useFactory: () => new PostgresUserRepository(pool),
    },
    {
      provide: 'IPasswordHasher',
      useClass: Argon2Hasher,
    },
    {
      provide: 'ITokenService',
      useClass: JwtTokenService,
    },
  ],
})
export class AppModule {}