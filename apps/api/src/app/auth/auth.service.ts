import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { SyncProfileDto } from './auth.dto';

@Injectable()
export class AuthService {
  constructor(private readonly prisma: PrismaService) {}

  async sync(sub: string, dto: SyncProfileDto) {
    const profile = await this.prisma.userProfile.upsert({
      where: { id: sub },
      create: {
        id: sub,
        email: dto.email ?? `${sub}@wso2.local`,
        fullName: dto.fullName,
      },
      update: {
        fullName: dto.fullName,
      },
    });

    const existingRoles = await this.prisma.userRole.count({
      where: { userProfileId: sub },
    });

    let roleName = dto.role ?? 'CUSTOMER';

    if (existingRoles === 0) {
      const role = await this.prisma.role.findUnique({ where: { name: roleName } });
      if (role) {
        await this.prisma.userRole.create({
          data: { userProfileId: sub, roleId: role.id },
        });
      }
    } else {
      const userRole = await this.prisma.userRole.findFirst({
        where: { userProfileId: sub },
        include: { role: true },
      });
      roleName = userRole?.role?.name ?? roleName;
    }

    if (roleName === 'CUSTOMER') {
      const existingCustomer = await this.prisma.customer.findUnique({
        where: { userProfileId: sub },
      });
      if (!existingCustomer) {
        await this.prisma.customer.create({
          data: {
            userProfileId: sub,
            status: 'PENDING_KYC',
          },
        });
      }
    }

    return profile;
  }

  async me(sub: string) {
    const profile = await this.prisma.userProfile.findUnique({
      where: { id: sub },
      include: {
        customer: {
          include: {
            profile: true,
            kyc: true,
          },
        },
        roles: {
          include: {
            role: {
              include: {
                permissions: {
                  include: {
                    permission: true,
                  },
                },
              },
            },
          },
        },
      },
    });

    if (!profile) throw new NotFoundException('Profile not found');
    return profile;
  }
}
