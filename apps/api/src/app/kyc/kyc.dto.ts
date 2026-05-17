import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsString, IsNotEmpty, IsOptional, IsObject, IsNumber } from 'class-validator';

export class KycSessionRequestDto {
  @ApiPropertyOptional({ example: 'KYC check for UK passport' })
  @IsOptional()
  @IsString()
  reason?: string;
}

export class BallerineWebhookResultDto {
  @ApiProperty({ example: 'approved' })
  @IsString()
  @IsNotEmpty()
  decision: string;

  @ApiPropertyOptional({ example: 'All documents verified' })
  @IsOptional()
  @IsString()
  decisionReason?: string;

  @ApiPropertyOptional({ example: 0.05 })
  @IsOptional()
  @IsNumber()
  riskScore?: number;
}

export class BallerineWebhookMetadataDto {
  @ApiProperty({ example: 'user-sub-id' })
  @IsString()
  @IsNotEmpty()
  customerId: string;
}

export class BallerineWebhookDto {
  @ApiProperty({ example: 'workflow.completed' })
  @IsString()
  @IsNotEmpty()
  eventName: string;

  @ApiProperty({ example: 'workflow-uuid-abc-123' })
  @IsString()
  @IsNotEmpty()
  workflowId: string;

  @ApiProperty({ example: 'completed' })
  @IsString()
  @IsNotEmpty()
  status: string;

  @ApiProperty({ type: BallerineWebhookResultDto })
  @IsObject()
  result: BallerineWebhookResultDto;

  @ApiProperty({ type: BallerineWebhookMetadataDto })
  @IsObject()
  metadata: BallerineWebhookMetadataDto;
}
