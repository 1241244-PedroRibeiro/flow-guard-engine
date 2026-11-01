import { Body, Controller, Get, Param, Patch, Post, Query, UseGuards } from '@nestjs/common';
import { UserService } from '../../../application/user/UserService';
import { Roles } from '../middlewares/decorators';
import { UserRole } from '../../../domain/user/UserRole';
import { CreateUserCommand } from '../../../application/user/dto/CreateUserCommand';
import { UpdateUserStatusCommand } from '../../../application/user/dto/UpdateUserStatusCommand';
import { UpdateUserRolesCommand } from '../../../application/user/dto/UpdateUserRolesCommand';

@Controller('users')
@Roles(UserRole.ADMINISTRATOR)
export class UserController {
  constructor(private readonly userService: UserService) {}

  @Post()
  async create(@Body() body: CreateUserCommand) {
    return this.userService.createUser(body);
  }

  @Get()
  async list(
    @Query('role') role?: string,
    @Query('status') status?: string,
    @Query('page') page = '1',
    @Query('pageSize') pageSize = '20',
  ) {
    return this.userService.listUsers({ role, status }, { page: Number(page), pageSize: Number(pageSize) });
  }

  @Patch(':id/status')
  async updateStatus(@Param('id') id: string, @Body() body: UpdateUserStatusCommand) {
    return this.userService.updateStatus(id, body);
  }

  @Patch(':id/roles')
  async updateRoles(@Param('id') id: string, @Body() body: UpdateUserRolesCommand) {
    return this.userService.updateRoles(id, body);
  }
}