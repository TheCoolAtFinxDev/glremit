import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsString, IsOptional, IsIn } from 'class-validator';

export class SyncProfileDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  email?: string;

  @ApiProperty()
  @IsString()
  fullName: string;

  @ApiProperty({
    enum: [
      'CUSTOMER',
      'ADMIN',
      'COMPLIANCE_OFFICER',
      'FINANCE_OFFICER',
      'OPERATIONS_OFFICER',
      'PARTNER_MANAGER',
      'SUPPORT_AGENT',
    ],
  })
  @IsIn([
    'CUSTOMER',
    'ADMIN',
    'COMPLIANCE_OFFICER',
    'FINANCE_OFFICER',
    'OPERATIONS_OFFICER',
    'PARTNER_MANAGER',
    'SUPPORT_AGENT',
  ])
  role: string;
}
