import { ApiProperty } from '@nestjs/swagger';
import { IsString, IsNumber, IsBoolean, IsNotEmpty, IsEnum, Min, Max } from 'class-validator';
import { PayoutMethod } from '@prisma/client';

export class CreatePairDto {
  @ApiProperty({ example: 'GBP' })
  @IsString()
  @IsNotEmpty()
  sourceCurrencyCode: string;

  @ApiProperty({ example: 'KES' })
  @IsString()
  @IsNotEmpty()
  destCurrencyCode: string;
}

export class UpdateRateDto {
  @ApiProperty({ example: 148.50 })
  @IsNumber()
  @Min(0.000001)
  rate: number;

  @ApiProperty({ example: 1.50 })
  @IsNumber()
  @Min(0)
  @Max(100)
  marginPercent: number;
}

export class CreateFeeRuleDto {
  @ApiProperty({ example: 'GB' })
  @IsString()
  @IsNotEmpty()
  sourceCountry: string;

  @ApiProperty({ example: 'KE' })
  @IsString()
  @IsNotEmpty()
  destCountry: string;

  @ApiProperty({ enum: PayoutMethod, example: 'BANK_ACCOUNT' })
  @IsEnum(PayoutMethod)
  payoutMethod: PayoutMethod;

  @ApiProperty({ example: 0 })
  @IsNumber()
  @Min(0)
  minAmount: number;

  @ApiProperty({ example: 10000 })
  @IsNumber()
  @Min(0)
  maxAmount: number;

  @ApiProperty({ example: 2.99 })
  @IsNumber()
  @Min(0)
  flatFee: number;

  @ApiProperty({ example: 0.5 })
  @IsNumber()
  @Min(0)
  @Max(100)
  percentFee: number;
}

export class CalculateQuoteDto {
  @ApiProperty({ example: 'GBP' })
  @IsString()
  @IsNotEmpty()
  sourceCurrency: string;

  @ApiProperty({ example: 'KES' })
  @IsString()
  @IsNotEmpty()
  destCurrency: string;

  @ApiProperty({ example: 100 })
  @IsNumber()
  @Min(1)
  sendAmount: number;

  @ApiProperty({ enum: PayoutMethod, example: 'BANK_ACCOUNT' })
  @IsEnum(PayoutMethod)
  payoutMethod: PayoutMethod;

  @ApiProperty({ example: 'GB' })
  @IsString()
  @IsNotEmpty()
  sourceCountry: string;

  @ApiProperty({ example: 'KE' })
  @IsString()
  @IsNotEmpty()
  destCountry: string;
}
