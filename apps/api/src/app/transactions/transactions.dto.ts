import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsString, IsNotEmpty, IsUUID, IsOptional, IsIn } from 'class-validator';

export class CreateTransactionDto {
  @ApiProperty({ example: 'quote-uuid-123' })
  @IsUUID()
  @IsNotEmpty()
  quoteId: string;

  @ApiProperty({ example: 'recipient-uuid-456' })
  @IsUUID()
  @IsNotEmpty()
  recipientId: string;

  @ApiProperty({ example: 'Family Support' })
  @IsString()
  @IsNotEmpty()
  purposeOfTransfer: string;

  @ApiProperty({ example: 'Salary' })
  @IsString()
  @IsNotEmpty()
  sourceOfFunds: string;
}

export class ConfirmPaymentDto {
  @ApiProperty({ example: 'TXN-BANK-REF-9988' })
  @IsString()
  @IsNotEmpty()
  paymentReference: string;

  @ApiProperty({ example: 'BANK_TRANSFER' })
  @IsString()
  @IsNotEmpty()
  paymentMethod: string;
}

export class ComplianceReviewDto {
  @ApiProperty({ example: 'APPROVED' })
  @IsIn(['APPROVED', 'REJECTED'])
  decision: 'APPROVED' | 'REJECTED';

  @ApiPropertyOptional({ example: 'Verified source of funds with paystub' })
  @IsOptional()
  @IsString()
  notes?: string;
}
