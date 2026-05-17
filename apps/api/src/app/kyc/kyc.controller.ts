import { Body, Controller, Post, UseGuards, Headers, UnauthorizedException } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { KycService } from './kyc.service';
import { KycSessionRequestDto, BallerineWebhookDto } from './kyc.dto';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CurrentUser } from '../auth/current-user.decorator';
import { ConfigService } from '@nestjs/config';

@ApiTags('kyc')
@Controller('kyc')
export class KycController {
  constructor(
    private readonly kycService: KycService,
    private readonly config: ConfigService,
  ) {}

  @Post('session')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Initiate dynamic KYC session with Ballerine' })
  initiateKycSession(@CurrentUser() user: any, @Body() dto: KycSessionRequestDto) {
    return this.kycService.initiateKycSession(user.sub, dto);
  }

  @Post('webhook')
  @ApiOperation({ summary: 'Ballerine Webhook receiver endpoint' })
  handleWebhook(
    @Body() dto: BallerineWebhookDto,
    @Headers('x-webhook-token') token?: string,
  ) {
    const expectedToken = this.config.get<string>('BALLERINE_WEBHOOK_SECRET');
    if (expectedToken && token !== expectedToken) {
      throw new UnauthorizedException('Invalid webhook signature or token');
    }
    return this.kycService.handleWebhook(dto);
  }
}
