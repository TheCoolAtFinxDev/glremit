import { Body, Controller, Get, Param, Post, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { TransactionsService } from './transactions.service';
import { CreateTransactionDto, ConfirmPaymentDto, ComplianceReviewDto } from './transactions.dto';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { PermissionsGuard, RequirePermission } from '../auth/permissions.guard';
import { CurrentUser } from '../auth/current-user.decorator';

@ApiTags('transactions')
@Controller('transactions')
@UseGuards(JwtAuthGuard, PermissionsGuard)
@ApiBearerAuth()
export class TransactionsController {
  constructor(private readonly transactionsService: TransactionsService) {}

  @Post()
  @RequirePermission('transactions', 'create')
  @ApiOperation({ summary: 'Create a new remittance transaction from an active quote' })
  create(@CurrentUser() user: any, @Body() dto: CreateTransactionDto) {
    return this.transactionsService.create(user.sub, dto);
  }

  @Post(':id/pay')
  @RequirePermission('transactions', 'create')
  @ApiOperation({ summary: 'Confirm customer payment and initiate automated compliance check pipeline' })
  confirmPayment(@Param('id') id: string, @Body() dto: ConfirmPaymentDto) {
    return this.transactionsService.confirmPayment(id, dto);
  }

  @Post(':id/compliance/review')
  @RequirePermission('compliance', 'review')
  @ApiOperation({ summary: 'Admin manual approval or rejection override for flagged compliance transactions' })
  adminReview(
    @Param('id') id: string,
    @CurrentUser() reviewer: any,
    @Body() dto: ComplianceReviewDto,
  ) {
    return this.transactionsService.adminReview(id, reviewer.sub, dto);
  }

  @Get()
  @RequirePermission('transactions', 'read')
  @ApiOperation({ summary: 'Get list of transactions (Customers get their own, Internal staff get all)' })
  getTransactions(@CurrentUser() user: any) {
    return this.transactionsService.getTransactions(user.sub);
  }
}
