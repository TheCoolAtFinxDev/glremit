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

  console.log('🎉 Golink Remit Dynamic RBAC Seeding Completed!');
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
