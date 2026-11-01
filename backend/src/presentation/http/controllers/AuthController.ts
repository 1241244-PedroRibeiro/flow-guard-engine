import { Body, Controller, Post } from '@nestjs/common';
import { AuthService } from '../../../application/auth/AuthService';
import { LoginCommand } from '../../../application/auth/dto/LoginCommand';
import { RegisterCommand } from '../../../application/auth/dto/RegisterCommand';
import { Public } from '../middlewares/decorators';

@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Public()
  @Post('login')
  async login(@Body() body: LoginCommand) {
    return this.authService.login(body);
  }

  @Public()
  @Post('register')
  async register(@Body() body: RegisterCommand) {
    return this.authService.register(body);
  }
}