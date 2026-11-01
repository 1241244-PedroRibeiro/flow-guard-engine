import { Body, Controller, HttpCode, HttpStatus, Post } from '@nestjs/common';
import { AuthService } from '../../../application/auth/AuthService';
import { LoginCommand } from '../../../application/auth/dto/LoginCommand';
import { RegisterCommand } from '../../../application/auth/dto/RegisterCommand';
import { Public } from '../middlewares/decorators';

@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Public()
  @Post('login')
  @HttpCode(HttpStatus.OK)
  async login(@Body() body: LoginCommand) {
    return this.authService.login(body);
  }

  @Public()
  @Post('register')
  async register(@Body() body: RegisterCommand) {
    return this.authService.register(body);
  }
}