import { Injectable, BadRequestException, Logger, NotFoundException } from '@nestjs/common';
import { HttpService } from '@nestjs/axios';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../prisma/prisma.service';
import { KycSessionRequestDto, BallerineWebhookDto } from './kyc.dto';
import { KycStatus } from '@prisma/client';
import { firstValueFrom } from 'rxjs';

@Injectable()
export class KycService {
  private readonly logger = new Logger(KycService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly httpService: HttpService,
    private readonly config: ConfigService,
  ) {}

  async initiateKycSession(userSub: string, dto: KycSessionRequestDto) {
    const customer = await this.prisma.customer.findUnique({
      where: { userProfileId: userSub },
      include: { profile: true, userProfile: true },
    });

    if (!customer) {
      throw new NotFoundException('Customer profile not found');
    }

    const ballerineUrl = this.config.get<string>('BALLERINE_URL');
    const apiKey = this.config.get<string>('BALLERINE_API_KEY');

    let workflowId = `bln-wf-${Math.random().toString(36).substring(2, 11)}`;
    let verificationUrl = `https://kyc.golinkremit.com/session/${workflowId}`;

    if (ballerineUrl && apiKey) {
      try {
        const payload = {
          workflowId: 'kyc-individual-workflow',
          metadata: {
            customerId: userSub,
          },
          context: {
            firstName: customer.profile?.firstName || 'User',
            lastName: customer.profile?.lastName || 'User',
            email: customer.userProfile?.email || '',
            phone: customer.profile?.phoneNumber || '',
          },
        };

        const response = await firstValueFrom(
          this.httpService.post(`${ballerineUrl}/api/v1/workflows`, payload, {
            headers: { Authorization: `Bearer ${apiKey}` },
          }),
        );

        if (response.data?.id) {
          workflowId = response.data.id;
          verificationUrl = response.data.verificationUrl || verificationUrl;
        }
      } catch (err: any) {
        this.logger.warn(`Failed outbound HTTP request to Ballerine at ${ballerineUrl}. Error: ${err.message}. Falling back to mock session.`);
      }
    } else {
      this.logger.log('Ballerine environment config not set. Utilizing local sandbox mock session.');
    }

    // Upsert local KYC check session
    const existingKyc = await this.prisma.customerKyc.findFirst({
      where: { customerId: customer.id },
    });

    if (existingKyc) {
      await this.prisma.customerKyc.update({
        where: { id: existingKyc.id },
        data: {
          workflowId,
          status: KycStatus.IN_PROGRESS,
        },
      });
    } else {
      await this.prisma.customerKyc.create({
        data: {
          customerId: customer.id,
          workflowId,
          status: KycStatus.IN_PROGRESS,
        },
      });
    }

    return {
      workflowId,
      verificationUrl,
    };
  }

  async handleWebhook(dto: BallerineWebhookDto) {
    // 1. Log webhook event
    await this.prisma.webhookEvent.create({
      data: {
        provider: 'BALLERINE',
        eventId: dto.workflowId,
        payload: dto as any,
        processed: true,
      },
    });

    // 2. Find KYC session
    const kyc = await this.prisma.customerKyc.findFirst({
      where: { workflowId: dto.workflowId },
      include: { customer: true },
    });

    if (!kyc) {
      throw new NotFoundException(`No local KYC session matches workflowId ${dto.workflowId}`);
    }

    // 3. Map status
    let mappedStatus: KycStatus = KycStatus.IN_PROGRESS;
    const decision = dto.result.decision.toLowerCase();

    if (decision === 'approved') {
      mappedStatus = KycStatus.APPROVED;
    } else if (decision === 'rejected') {
      mappedStatus = KycStatus.REJECTED;
    } else {
      mappedStatus = KycStatus.ACTION_REQUIRED;
    }

    // 4. Update dynamic KYC session record
    await this.prisma.customerKyc.update({
      where: { id: kyc.id },
      data: {
        status: mappedStatus,
        riskScore: dto.result.riskScore,
        decision: dto.result.decision,
        decisionReason: dto.result.decisionReason,
      },
    });

    // 5. Update parent Customer status
    let customerStatus = kyc.customer.status;
    if (mappedStatus === KycStatus.APPROVED) {
      customerStatus = 'KYC_VERIFIED';
    } else if (mappedStatus === KycStatus.REJECTED) {
      customerStatus = 'KYC_REJECTED';
    }

    await this.prisma.customer.update({
      where: { id: kyc.customerId },
      data: { status: customerStatus },
    });

    // 6. Log dynamic audit record
    await this.prisma.auditLog.create({
      data: {
        actorId: kyc.customer.userProfileId,
        action: 'CUSTOMER_KYC_RESOLVED',
        entityName: 'Customer',
        entityId: kyc.customer.id,
        correlationId: dto.workflowId,
        afterData: { status: customerStatus, decision: dto.result.decision, reason: dto.result.decisionReason } as any,
        ipAddress: '127.0.0.1',
      },
    });

    return {
      status: 'success',
      workflowId: dto.workflowId,
      decision: dto.result.decision,
    };
  }
}
