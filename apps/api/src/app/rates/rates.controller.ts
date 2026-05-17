import { Body, Controller, Get, Param, Post, Put, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { RatesService } from './rates.service';
import { CreatePairDto, UpdateRateDto, CreateFeeRuleDto, CalculateQuoteDto } from './rates.dto';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { PermissionsGuard, RequirePermission } from '../auth/permissions.guard';

@ApiTags('rates')
@Controller('rates')
@UseGuards(JwtAuthGuard, PermissionsGuard)
@ApiBearerAuth()
export class RatesController {
  constructor(private readonly ratesService: RatesService) {}

  @Post('pairs')
  @RequirePermission('rates', 'manage')
  @ApiOperation({ summary: 'Create source-destination currency pair' })
  createPair(@Body() dto: CreatePairDto) {
    return this.ratesService.createPair(dto);
  }

  @Put('pairs/:id/rate')
  @RequirePermission('rates', 'manage')
  @ApiOperation({ summary: 'Set or update rate and margin for a pair' })
  updateRate(@Param('id') id: string, @Body() dto: UpdateRateDto) {
    return this.ratesService.updateRate(id, dto);
  }

  @Post('fee-rules')
  @RequirePermission('rates', 'manage')
  @ApiOperation({ summary: 'Create dynamic corridor fee tier rule' })
  createFeeRule(@Body() dto: CreateFeeRuleDto) {
    return this.ratesService.createFeeRule(dto);
  }

  @Post('quotes')
  @RequirePermission('quotes', 'create')
  @ApiOperation({ summary: 'Calculate and issue a locked remittance quote' })
  calculateQuote(@Body() dto: CalculateQuoteDto) {
    return this.ratesService.calculateQuote(dto);
  }

  @Get('pairs')
  @RequirePermission('rates', 'read')
  @ApiOperation({ summary: 'Get active currency pairings and latest rates' })
  getPairs() {
    return this.ratesService.getPairs();
  }
}
