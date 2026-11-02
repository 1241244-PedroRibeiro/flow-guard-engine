import { UserResponseDto } from '../../user/dto/UserResponseDto';

export interface LoginResponseDto {
  accessToken: string;
  tokenType: string;
  expiresIn: number;
  user: UserResponseDto;
}