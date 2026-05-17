import { Injectable, BadRequestException, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreatePairDto, UpdateRateDto, CreateFeeRuleDto, CalculateQuoteDto } from './rates.dto';

@Injectable()
export class RatesService {
  constructor(private readonly prisma: PrismaService) {}

  async createPair(dto: CreatePairDto) {
    const source = await this.prisma.currency.findUnique({
      where: { code: dto.sourceCurrencyCode },
    });
    const dest = await this.prisma.currency.findUnique({
      where: { code: dto.destCurrencyCode },
    });

    if (!source || !dest) {
      throw new BadRequestException('Source or destination currency does not exist');
    }

    return this.prisma.currencyPair.upsert({
      where: {
        sourceCurrencyCode_destCurrencyCode: {
          sourceCurrencyCode: dto.sourceCurrencyCode,
          destCurrencyCode: dto.destCurrencyCode,
        },
      },
      create: {
        sourceCurrencyCode: dto.sourceCurrencyCode,
        destCurrencyCode: dto.destCurrencyCode,
        isActive: true,
      },
      update: {
        isActive: true,
      },
    });
  }

  async updateRate(pairId: string, dto: UpdateRateDto) {
    const pair = await this.prisma.currencyPair.findUnique({
      where: { id: pairId },
    });

    if (!pair) {
      throw new NotFoundException('Currency pair not found');
    }

    const latestRate = await this.prisma.exchangeRate.findFirst({
      where: { pairId },
      orderBy: { createdAt: 'desc' },
    });

    if (latestRate) {
      return this.prisma.exchangeRate.update({
        where: { id: latestRate.id },
        data: {
          rate: dto.rate,
          marginPercent: dto.marginPercent,
        },
      });
    }

    return this.prisma.exchangeRate.create({
      data: {
        pairId,
        rate: dto.rate,
        marginPercent: dto.marginPercent,
      },
    });
  }

  async createFeeRule(dto: CreateFeeRuleDto) {
    return this.prisma.feeRule.create({
      data: {
        sourceCountry: dto.sourceCountry,
        destCountry: dto.destCountry,
        payoutMethod: dto.payoutMethod,
        minAmount: dto.minAmount,
        maxAmount: dto.maxAmount,
        flatFee: dto.flatFee,
        percentFee: dto.percentFee,
      },
    });
  }

  async calculateQuote(dto: CalculateQuoteDto) {
    const pair = await this.prisma.currencyPair.findUnique({
      where: {
        sourceCurrencyCode_destCurrencyCode: {
          sourceCurrencyCode: dto.sourceCurrency,
          destCurrencyCode: dto.destCurrency,
        },
      },
      include: {
        exchangeRates: {
          orderBy: { createdAt: 'desc' },
          take: 1,
        },
      },
    });

    if (!pair || !pair.isActive) {
      throw new BadRequestException(`Corridor ${dto.sourceCurrency} -> ${dto.destCurrency} is not active`);
    }

    const exchangeRateRecord = pair.exchangeRates[0];
    if (!exchangeRateRecord) {
      throw new BadRequestException('Exchange rate is not defined for this pair');
    }

    // actualRate = baseRate * (1 + marginPercent / 100)
    const baseRate = Number(exchangeRateRecord.rate);
    const margin = Number(exchangeRateRecord.marginPercent);
    const actualRate = baseRate * (1 + margin / 100);

    // Look up fee rule
    const feeRule = await this.prisma.feeRule.findFirst({
      where: {
        sourceCountry: dto.sourceCountry,
        destCountry: dto.destCountry,
        payoutMethod: dto.payoutMethod,
        minAmount: { lte: dto.sendAmount },
        maxAmount: { gte: dto.sendAmount },
      },
    });

    let flatFee = 0;
    let percentFee = 0;

    if (feeRule) {
      flatFee = Number(feeRule.flatFee);
      percentFee = Number(feeRule.percentFee);
    } else {
      // Default fallback fee if no rule matches
      flatFee = 2.50; 
      percentFee = 0.5;
    }

    const feeAmount = flatFee + (dto.sendAmount * percentFee) / 100;
    
    if (feeAmount >= dto.sendAmount) {
      throw new BadRequestException('Send amount must be greater than the calculated fee');
    }

    const netSendAmount = dto.sendAmount - feeAmount;
    const receiveAmount = netSendAmount * actualRate;

    // Create quote record valid for 10 minutes
    const expiresAt = new Date();
    expiresAt.setMinutes(expiresAt.getMinutes() + 10);

    return this.prisma.remittanceQuote.create({
      data: {
        pairId: pair.id,
        sendAmount: dto.sendAmount,
        receiveAmount: receiveAmount,
        exchangeRate: actualRate,
        feeAmount: feeAmount,
        totalPayable: dto.sendAmount,
        expiresAt,
      },
      include: {
        pair: true,
      },
    });
  }

  async getPairs() {
    return this.prisma.currencyPair.findMany({
      include: {
        exchangeRates: {
          orderBy: { createdAt: 'desc' },
          take: 1,
        },
      },
    });
  }
}
