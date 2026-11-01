import { CanActivate, ExecutionContext, ForbiddenException, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { ROLES_KEY } from '../middlewares/decorators';
import { UserRole } from '../../../domain/user/UserRole';

@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const requiredRoles = this.reflector.getAllAndOverride<UserRole[]>(ROLES_KEY, [context.getHandler(), context.getClass()]);
    if (!requiredRoles || requiredRoles.length === 0) return true;

    const { user } = context.switchToHttp().getRequest();
    if (!user || !user.roles) throw new ForbiddenException('User roles not found');

    const hasRole = requiredRoles.some((role) => user.roles.includes(role));
    if (!hasRole) throw new ForbiddenException('Insufficient permissions');
    return true;
  }
}