import { Injectable, BadRequestException, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateTransactionDto, ConfirmPaymentDto, ComplianceReviewDto } from './transactions.dto';
import { RemittanceStatus, PaymentStatus, ComplianceStatus, ComplianceCheckType } from '@prisma/client';

@Injectable()
export class TransactionsService {
  constructor(private readonly prisma: PrismaService) {}

  async create(userSub: string, dto: CreateTransactionDto) {
    const customer = await this.prisma.customer.findUnique({
      where: { userProfileId: userSub },
    });

    if (!customer) {
      throw new NotFoundException('Customer profile not found');
    }

    if (customer.status !== 'KYC_VERIFIED') {
      throw new BadRequestException('Customer KYC must be VERIFIED before submitting transactions');
    }

    const quote = await this.prisma.remittanceQuote.findUnique({
      where: { id: dto.quoteId },
    });

    if (!quote) {
      throw new NotFoundException('Remittance quote not found');
    }

    if (quote.expiresAt < new Date()) {
      throw new BadRequestException('Remittance quote has expired. Please calculate a new quote');
    }

    const recipient = await this.prisma.recipient.findFirst({
      where: { id: dto.recipientId, customerId: customer.id },
    });

    if (!recipient) {
      throw new NotFoundException('Recipient not found or does not belong to this customer');
    }

    return this.prisma.remittanceTransaction.create({
      data: {
        customerId: customer.id,
        recipientId: recipient.id,
        pairId: quote.pairId,
        quoteId: quote.id,
        sendAmount: quote.sendAmount,
        receiveAmount: quote.receiveAmount,
        feeAmount: quote.feeAmount,
        exchangeRate: quote.exchangeRate,
        purposeOfTransfer: dto.purposeOfTransfer,
        sourceOfFunds: dto.sourceOfFunds,
        status: RemittanceStatus.QUOTE_CREATED,
      },
      include: {
        recipient: true,
        pair: true,
      },
    });
  }

  async confirmPayment(transactionId: string, dto: ConfirmPaymentDto) {
    const tx = await this.prisma.remittanceTransaction.findUnique({
      where: { id: transactionId },
      include: { recipient: true, customer: true },
    });

    if (!tx) {
      throw new NotFoundException('Transaction not found');
    }

    if (tx.status !== RemittanceStatus.QUOTE_CREATED) {
      throw new BadRequestException('Payment can only be confirmed for newly created quotes');
    }

    // 1. Register Payment Collection
    await this.prisma.paymentCollection.create({
      data: {
        transactionId: tx.id,
        paymentMethod: dto.paymentMethod,
        providerName: 'GOLINK_PG',
        providerReference: dto.paymentReference,
        amount: tx.sendAmount,
        status: PaymentStatus.CONFIRMED,
      },
    });

    // 2. Update Transaction Status
    let currentTx = await this.prisma.remittanceTransaction.update({
      where: { id: tx.id },
      data: { status: RemittanceStatus.PAYMENT_CONFIRMED },
    });

    // 3. Execute Compliance Pipeline
    let compliancePassed = true;
    const errors: string[] = [];

    // Check 1: Corridor Limit Check
    const limitCheckStatus = Number(tx.sendAmount) > 5000 ? ComplianceStatus.FAILED : ComplianceStatus.PASSED;
    if (limitCheckStatus === ComplianceStatus.FAILED) {
      compliancePassed = false;
      errors.push('Transaction exceeds corridor limit of 5,000');
    }

    await this.prisma.complianceCheck.create({
      data: {
        transactionId: tx.id,
        checkType: ComplianceCheckType.TRANSACTION_LIMIT,
        status: limitCheckStatus,
        resultDetails: { notes: limitCheckStatus === ComplianceStatus.FAILED ? 'Limit exceeded' : 'Limit check passed' },
      },
    });

    // Check 2: PEP Sanction Screening Check
    const recipientName = tx.recipient.fullName.toLowerCase();
    const screeningStatus = recipientName.includes('sanctioned') || recipientName.includes('pep')
      ? ComplianceStatus.FAILED
      : ComplianceStatus.PASSED;

    if (screeningStatus === ComplianceStatus.FAILED) {
      compliancePassed = false;
      errors.push('Recipient flagged in PEP/Sanction screening');
    }

    await this.prisma.complianceCheck.create({
      data: {
        transactionId: tx.id,
        checkType: ComplianceCheckType.SANCTIONS_SCREENING,
        status: screeningStatus,
        resultDetails: { notes: screeningStatus === ComplianceStatus.FAILED ? 'Flagged name' : 'Screening passed' },
      },
    });

    // 4. Resolve State depending on Compliance
    if (compliancePassed) {
      currentTx = await this.prisma.remittanceTransaction.update({
        where: { id: tx.id },
        data: { status: RemittanceStatus.COMPLIANCE_PASSED },
      });

      // Shift to payout
      currentTx = await this.prisma.remittanceTransaction.update({
        where: { id: tx.id },
        data: { status: RemittanceStatus.PAYOUT_PENDING },
      });

      // Dispatch Partner Payout Request (Mock integration dispatch)
      const payoutRef = `PAY-OUT-${Math.random().toString(36).substring(2, 11).toUpperCase()}`;
      await this.prisma.partnerProfile.upsert({
        where: { id: 'mock-partner-id' },
        create: { id: 'mock-partner-id', name: 'Mock Payout Partner', code: 'MOCK_PARTNER' },
        update: {},
      });

      await this.prisma.partnerPayoutRequest.create({
        data: {
          transactionId: tx.id,
          partnerId: 'mock-partner-id',
          partnerReference: payoutRef,
          status: 'SENT',
        },
      });

      currentTx = await this.prisma.remittanceTransaction.update({
        where: { id: tx.id },
        data: { status: RemittanceStatus.SENT_TO_PARTNER },
      });
    } else {
      currentTx = await this.prisma.remittanceTransaction.update({
        where: { id: tx.id },
        data: { status: RemittanceStatus.COMPLIANCE_PENDING },
      });

      // Log compliance failure in audit trails
      await this.prisma.auditLog.create({
        data: {
          actorId: tx.customer.userProfileId,
          action: 'TRANSACTION_COMPLIANCE_FLAGGED',
          entityName: 'RemittanceTransaction',
          entityId: tx.id,
          correlationId: tx.correlationId,
          afterData: { errors } as any,
          ipAddress: '127.0.0.1',
        },
      });
    }

    return this.prisma.remittanceTransaction.findUnique({
      where: { id: tx.id },
      include: {
        payment: true,
        complianceChecks: true,
        payoutRequest: true,
      },
    });
  }

  async adminReview(transactionId: string, reviewerSubId: string, dto: ComplianceReviewDto) {
    const tx = await this.prisma.remittanceTransaction.findUnique({
      where: { id: transactionId },
    });

    if (!tx) {
      throw new NotFoundException('Transaction not found');
    }

    if (tx.status !== RemittanceStatus.COMPLIANCE_PENDING) {
      throw new BadRequestException('Only compliance flagged transactions can be reviewed');
    }

    const reviewer = await this.prisma.userProfile.findUnique({
      where: { id: reviewerSubId },
    });

    if (dto.decision === 'APPROVED') {
      // 1. Update compliance checks to passed
      await this.prisma.complianceCheck.updateMany({
        where: { transactionId: tx.id },
        data: { status: ComplianceStatus.PASSED, resultDetails: { notes: dto.notes ?? 'Approved by compliance officer' } },
      });

      // 2. Set status to COMPLIANCE_PASSED -> PAYOUT_PENDING
      await this.prisma.remittanceTransaction.update({
        where: { id: tx.id },
        data: { status: RemittanceStatus.COMPLIANCE_PASSED },
      });

      await this.prisma.remittanceTransaction.update({
        where: { id: tx.id },
        data: { status: RemittanceStatus.PAYOUT_PENDING },
      });

      // 3. Dispatch payout
      const payoutRef = `PAY-OUT-${Math.random().toString(36).substring(2, 11).toUpperCase()}`;
      await this.prisma.partnerProfile.upsert({
        where: { id: 'mock-partner-id' },
        create: { id: 'mock-partner-id', name: 'Mock Payout Partner', code: 'MOCK_PARTNER' },
        update: {},
      });

      await this.prisma.partnerPayoutRequest.create({
        data: {
          transactionId: tx.id,
          partnerId: 'mock-partner-id',
          partnerReference: payoutRef,
          status: 'SENT',
        },
      });

      await this.prisma.remittanceTransaction.update({
        where: { id: tx.id },
        data: { status: RemittanceStatus.SENT_TO_PARTNER },
      });

      // 4. Create audit log
      await this.prisma.auditLog.create({
        data: {
          actorId: reviewerSubId,
          action: 'COMPLIANCE_MANUAL_APPROVE',
          entityName: 'RemittanceTransaction',
          entityId: tx.id,
          correlationId: tx.correlationId,
          afterData: { notes: dto.notes ?? 'Approved by compliance officer' } as any,
          ipAddress: '127.0.0.1',
        },
      });
    } else {
      // Compliance rejected
      await this.prisma.complianceCheck.updateMany({
        where: { transactionId: tx.id },
        data: { status: ComplianceStatus.FAILED, resultDetails: { notes: dto.notes ?? 'Rejected by compliance officer' } },
      });

      await this.prisma.remittanceTransaction.update({
        where: { id: tx.id },
        data: { status: RemittanceStatus.COMPLIANCE_FAILED },
      });

      await this.prisma.remittanceTransaction.update({
        where: { id: tx.id },
        data: { status: RemittanceStatus.FAILED },
      });

      // Audit log
      await this.prisma.auditLog.create({
        data: {
          actorId: reviewerSubId,
          action: 'COMPLIANCE_MANUAL_REJECT',
          entityName: 'RemittanceTransaction',
          entityId: tx.id,
          correlationId: tx.correlationId,
          afterData: { notes: dto.notes ?? 'Rejected by compliance officer' } as any,
          ipAddress: '127.0.0.1',
        },
      });
    }

    return this.prisma.remittanceTransaction.findUnique({
      where: { id: tx.id },
      include: {
        payment: true,
        complianceChecks: true,
        payoutRequest: true,
      },
    });
  }

  async getTransactions(userSub: string) {
    const customer = await this.prisma.customer.findUnique({
      where: { userProfileId: userSub },
    });

    if (!customer) {
      // Check if it is a staff user (Staff users don't have Customer record but UserProfile instead)
      return this.prisma.remittanceTransaction.findMany({
        include: {
          customer: { include: { profile: true } },
          recipient: true,
          payment: true,
          complianceChecks: true,
          payoutRequest: true,
        },
      });
    }

    return this.prisma.remittanceTransaction.findMany({
      where: { customerId: customer.id },
      include: {
        recipient: true,
        payment: true,
        complianceChecks: true,
        payoutRequest: true,
      },
    });
  }
}
