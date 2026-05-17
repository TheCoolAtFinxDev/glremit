import { Injectable } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { passportJwtSecret } from 'jwks-rsa';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class Wso2JwtStrategy extends PassportStrategy(Strategy, 'wso2-jwt') {
  constructor(
    config: ConfigService,
    private prisma: PrismaService,
  ) {
    super({
      secretOrKeyProvider: passportJwtSecret({
        cache: true,
        rateLimit: true,
        jwksRequestsPerMinute: 10,
        jwksUri: config.getOrThrow('WSO2_JWKS_URI'),
      }),
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      issuer: config.getOrThrow('WSO2_ISSUER'),
      algorithms: ['RS256'],
    });
  }

  async validate(payload: any) {
    const profile = await this.prisma.userProfile.findUnique({
      where: { id: payload.sub },
      include: {
        roles: {
          include: {
            role: true,
          },
        },
      },
    });

    return {
      sub: payload.sub,
      email: payload.email,
      roles: profile?.roles?.map(r => r.role.name) ?? [],
      primaryRole: profile?.roles?.[0]?.role.name ?? 'CUSTOMER',
    };
  }
}
