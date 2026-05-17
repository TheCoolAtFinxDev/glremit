import {
  Injectable, CanActivate, ExecutionContext,
  ForbiddenException, SetMetadata,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { PrismaService } from '../prisma/prisma.service';

export const PERMISSION_KEY = 'permission';
export const RequirePermission = (resource: string, action: string) =>
  SetMetadata(PERMISSION_KEY, `${resource}:${action}`);

@Injectable()
export class PermissionsGuard implements CanActivate {
  constructor(
    private reflector: Reflector,
    private prisma: PrismaService,
  ) {}

  async canActivate(ctx: ExecutionContext): Promise<boolean> {
    const required = this.reflector.getAllAndOverride<string>(PERMISSION_KEY, [
      ctx.getHandler(),
      ctx.getClass(),
    ]);

    if (!required) return true;

    const { user } = ctx.switchToHttp().getRequest();
    if (!user?.sub) throw new ForbiddenException();

    const [resource, action] = required.split(':');

    const permission = await this.prisma.rolePermission.findFirst({
      where: {
        role: {
          users: {
            some: { userProfileId: user.sub },
          },
        },
        permission: { resource, action },
      },
    });

    if (!permission) {
      throw new ForbiddenException(
        `Missing permission: ${required}`,
      );
    }

    return true;
  }
}
