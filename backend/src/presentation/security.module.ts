import { Global, Module } from '@nestjs/common';
import { JwtTokenService } from '../infrastructure/security/JwtTokenService';
import { Argon2Hasher } from '../infrastructure/security/Argon2Hasher';

@Global()
@Module({
    providers: [
        { provide: 'ITokenService', useFactory: () => new JwtTokenService() },
        { provide: 'IPasswordHasher', useFactory: () => new Argon2Hasher() },
    ],
    exports: ['ITokenService', 'IPasswordHasher'],
})
export class SecurityModule {}