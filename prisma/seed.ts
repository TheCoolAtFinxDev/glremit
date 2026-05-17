import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import { Pool } from 'pg';
import 'dotenv/config';

const pool = new Pool({
  host: process.env.DB_HOST,
  port: parseInt(process.env.DB_PORT || '6543', 10),
  database: process.env.DB_NAME,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  ssl: { rejectUnauthorized: false },
});

const adapter = new PrismaPg(pool as any);
const prisma = new PrismaClient({ adapter } as any);

const PERMISSIONS = [
  // Customers management
  { resource: 'customers',      action: 'read',     description: 'View customer list and details' },
  { resource: 'customers',      action: 'manage',   description: 'Manage customer accounts' },
  { resource: 'customers',      action: 'suspend',  description: 'Suspend customer accounts' },
  
  // KYC / Compliance
  { resource: 'kyc',            action: 'read',     description: 'View customer KYC sessions' },
  { resource: 'kyc',            action: 'review',   description: 'Approve or reject customer KYC' },
  
  // Quotes
  { resource: 'quotes',         action: 'read',     description: 'View remittance quotes' },
  { resource: 'quotes',         action: 'create',   description: 'Create remittance quotes' },
  
  // Transactions
  { resource: 'transactions',   action: 'read',     description: 'View transaction history' },
  { resource: 'transactions',   action: 'create',   description: 'Initiate remittance transactions' },
  { resource: 'transactions',   action: 'cancel',   description: 'Cancel pending transactions' },
  { resource: 'transactions',   action: 'reverse',  description: 'Reverse completed transactions' },
  
  // Compliance checking
  { resource: 'compliance',     action: 'read',     description: 'View compliance checks' },
  { resource: 'compliance',     action: 'review',   description: 'Manually approve/reject compliance reviews' },
  
  // Exchange Rates & Fees
  { resource: 'rates',          action: 'read',     description: 'View exchange rates and fee rules' },
  { resource: 'rates',          action: 'manage',   description: 'Manage currencies, exchange rates, and fee rules' },
  
  // Partners & Corridors
  { resource: 'partners',       action: 'read',     description: 'View partners and corridors' },
  { resource: 'partners',       action: 'manage',   description: 'Manage partner profiles, limits, and corridors' },
  
  // Partner Payouts
  { resource: 'payouts',        action: 'read',     description: 'View payout requests' },
  { resource: 'payouts',        action: 'retry',    description: 'Retry failed payouts' },
  { resource: 'payouts',        action: 'manage',   description: 'Manually process payout status' },
  
  // Settlements
  { resource: 'settlements',    action: 'read',     description: 'View settlement batches' },
  { resource: 'settlements',    action: 'create',   description: 'Generate settlement batches' },
  { resource: 'settlements',    action: 'approve',  description: 'Approve settlement batches' },
  { resource: 'settlements',    action: 'settle',   description: 'Mark settlements as settled' },
  
  // Reconciliations
  { resource: 'reconciliation', action: 'read',     description: 'View reconciliations' },
  { resource: 'reconciliation', action: 'run',      description: 'Run reconciliation jobs' },
  
  // Reports
  { resource: 'reports',        action: 'read',     description: 'View financial and operation reports' },
  
  // System parameters
  { resource: 'system',         action: 'manage',   description: 'Manage system configuration parameters' },
];

const ROLES = [
  {
    name: 'CUSTOMER',
    description: 'Golink Remit Customer (Money Sender)',
    isSystem: true,
    permissions: [
      'quotes:read', 'quotes:create',
      'transactions:read', 'transactions:create', 'transactions:cancel',
      'customers:read',
    ],
  },
  {
    name: 'ADMIN',
    description: 'Platform Administrator with full access',
    isSystem: true,
    permissions: [
      'customers:read', 'customers:manage', 'customers:suspend',
      'kyc:read', 'kyc:review',
      'quotes:read', 'quotes:create',
      'transactions:read', 'transactions:create', 'transactions:cancel', 'transactions:reverse',
      'compliance:read', 'compliance:review',
      'rates:read', 'rates:manage',
      'partners:read', 'partners:manage',
      'payouts:read', 'payouts:retry', 'payouts:manage',
      'settlements:read', 'settlements:create', 'settlements:approve', 'settlements:settle',
      'reconciliation:read', 'reconciliation:run',
      'reports:read',
      'system:manage',
    ],
  },
  {
    name: 'COMPLIANCE_OFFICER',
    description: 'Compliance Officer enforcing KYC and AML rules',
    isSystem: true,
    permissions: [
      'customers:read',
      'kyc:read', 'kyc:review',
      'transactions:read',
      'compliance:read', 'compliance:review',
      'reports:read',
    ],
  },
  {
    name: 'FINANCE_OFFICER',
    description: 'Finance Officer managing liquidity, rates, and settlement',
    isSystem: true,
    permissions: [
      'transactions:read',
      'rates:read', 'rates:manage',
      'settlements:read', 'settlements:create', 'settlements:approve', 'settlements:settle',
      'reconciliation:read', 'reconciliation:run',
      'reports:read',
    ],
  },
  {
    name: 'OPERATIONS_OFFICER',
    description: 'Operations Officer managing daily payout queues and partner feeds',
    isSystem: true,
    permissions: [
      'customers:read',
      'transactions:read', 'transactions:cancel',
      'payouts:read', 'payouts:retry', 'payouts:manage',
      'partners:read',
      'reports:read',
    ],
  },
  {
    name: 'PARTNER_MANAGER',
    description: 'Partner Manager overlooking payout partners and corridor setups',
    isSystem: true,
    permissions: [
      'partners:read', 'partners:manage',
      'rates:read',
      'reports:read',
    ],
  },
  {
    name: 'SUPPORT_AGENT',
    description: 'Customer Support Agent answering requests',
    isSystem: true,
    permissions: [
      'customers:read', 'customers:manage',
      'kyc:read',
      'transactions:read',
      'quotes:read',
      'payouts:read',
    ],
  },
];

const CURRENCIES = [
  { code: 'GBP', name: 'British Pound Sterling', symbol: '£', decimals: 2, isActive: true },
  { code: 'USD', name: 'US Dollar', symbol: '$', decimals: 2, isActive: true },
  { code: 'EUR', name: 'Euro', symbol: '€', decimals: 2, isActive: true },
  { code: 'KES', name: 'Kenyan Shilling', symbol: 'KSh', decimals: 2, isActive: true },
  { code: 'UGX', name: 'Ugandan Shilling', symbol: 'USh', decimals: 2, isActive: true },
  { code: 'GHS', name: 'Ghanaian Cedi', symbol: 'GH₵', decimals: 2, isActive: true },
];

const CURRENCY_PAIRS = [
  { sourceCurrencyCode: 'GBP', destCurrencyCode: 'KES', baseRate: 150.00, margin: 1.5 },
  { sourceCurrencyCode: 'USD', destCurrencyCode: 'KES', baseRate: 120.00, margin: 1.2 },
  { sourceCurrencyCode: 'USD', destCurrencyCode: 'UGX', baseRate: 3700.00, margin: 1.0 },
  { sourceCurrencyCode: 'EUR', destCurrencyCode: 'GHS', baseRate: 12.50, margin: 1.8 },
];

const FEE_RULES = [
  {
    sourceCountry: 'GB',
    destCountry: 'KE',
    payoutMethod: 'BANK_ACCOUNT' as const,
    minAmount: 0,
    maxAmount: 10000,
    flatFee: 2.99,
    percentFee: 0.5,
  },
  {
    sourceCountry: 'GB',
    destCountry: 'KE',
    payoutMethod: 'MOBILE_MONEY' as const,
    minAmount: 0,
    maxAmount: 5000,
    flatFee: 1.99,
    percentFee: 0.8,
  },
  {
    sourceCountry: 'US',
    destCountry: 'UG',
    payoutMethod: 'MOBILE_MONEY' as const,
    minAmount: 0,
    maxAmount: 20000,
    flatFee: 3.99,
    percentFee: 0.3,
  },
];

async function main() {
  console.log('🌱 Seeding Golink Remit dynamic RBAC & Permissions...');

  for (const perm of PERMISSIONS) {
    await prisma.permission.upsert({
      where: { resource_action: { resource: perm.resource, action: perm.action } },
      create: perm,
      update: { description: perm.description },
    });
  }
  console.log(`✅ ${PERMISSIONS.length} permissions successfully seeded`);

  for (const roleData of ROLES) {
    const role = await prisma.role.upsert({
      where: { name: roleData.name },
      create: {
        name: roleData.name,
        description: roleData.description,
        isSystem: roleData.isSystem,
      },
      update: { description: roleData.description },
    });

    for (const permKey of roleData.permissions) {
      const [resource, action] = permKey.split(':');
      const perm = await prisma.permission.findUnique({
        where: { resource_action: { resource, action } },
      });
      if (perm) {
        await prisma.rolePermission.upsert({
          where: { roleId_permissionId: { roleId: role.id, permissionId: perm.id } },
          create: { roleId: role.id, permissionId: perm.id },
          update: {},
        });
      }
    }
    console.log(`✅ Role ${roleData.name} seeded with ${roleData.permissions.length} permissions`);
  }

  console.log('🌱 Seeding Currencies and Corridors...');
  for (const curr of CURRENCIES) {
    await prisma.currency.upsert({
      where: { code: curr.code },
      create: curr,
      update: { name: curr.name, symbol: curr.symbol, isActive: curr.isActive },
    });
  }
  console.log(`✅ ${CURRENCIES.length} currencies seeded`);

  for (const pairData of CURRENCY_PAIRS) {
    const pair = await prisma.currencyPair.upsert({
      where: {
        sourceCurrencyCode_destCurrencyCode: {
          sourceCurrencyCode: pairData.sourceCurrencyCode,
          destCurrencyCode: pairData.destCurrencyCode,
        },
      },
      create: {
        sourceCurrencyCode: pairData.sourceCurrencyCode,
        destCurrencyCode: pairData.destCurrencyCode,
        isActive: true,
      },
      update: { isActive: true },
    });

    // Seed/upsert exchange rate
    const latestRate = await prisma.exchangeRate.findFirst({
      where: { pairId: pair.id },
      orderBy: { createdAt: 'desc' },
    });
    if (!latestRate) {
      await prisma.exchangeRate.create({
        data: {
          pairId: pair.id,
          rate: pairData.baseRate,
          marginPercent: pairData.margin,
        },
      });
    } else {
      await prisma.exchangeRate.update({
        where: { id: latestRate.id },
        data: {
          rate: pairData.baseRate,
          marginPercent: pairData.margin,
        },
      });
    }
    console.log(`✅ Seeded Corridor ${pairData.sourceCurrencyCode} -> ${pairData.destCurrencyCode} with rate ${pairData.baseRate} (margin: ${pairData.margin}%)`);
  }

  console.log('🌱 Seeding Corridor Fee Rules...');
  for (const rule of FEE_RULES) {
    const existingRule = await prisma.feeRule.findFirst({
      where: {
        sourceCountry: rule.sourceCountry,
        destCountry: rule.destCountry,
        payoutMethod: rule.payoutMethod,
        minAmount: rule.minAmount,
        maxAmount: rule.maxAmount,
      },
    });
    if (!existingRule) {
      await prisma.feeRule.create({ data: rule });
    } else {
      await prisma.feeRule.update({
        where: { id: existingRule.id },
        data: {
          flatFee: rule.flatFee,
          percentFee: rule.percentFee,
        },
      });
    }
  }
  console.log(`✅ ${FEE_RULES.length} fee rules seeded`);

  console.log('🎉 Golink Remit Dynamic RBAC & Corridor Seeding Completed!');
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
