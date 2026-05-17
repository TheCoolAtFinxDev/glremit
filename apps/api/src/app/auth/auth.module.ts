import { Module } from '@nestjs/common';
import { PassportModule } from '@nestjs/passport';
import { ConfigModule } from '@nestjs/config';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { Wso2JwtStrategy } from './wso2-jwt.strategy';
import { RolesGuard } from './roles.guard';
import { PermissionsGuard } from './permissions.guard';

@Module({
  imports: [
    PassportModule.register({ defaultStrategy: 'wso2-jwt' }),
    ConfigModule,
  ],
  controllers: [AuthController],
  providers: [AuthService, Wso2JwtStrategy, RolesGuard, PermissionsGuard],
  exports: [AuthService, RolesGuard, PermissionsGuard, PassportModule],
})
export class AuthModule {}
