import { defineConfig } from 'prisma/config';
import 'dotenv/config';

const dbUrl = process.env.DIRECT_URL || process.env.DATABASE_URL || "postgresql://golink_remit_user:golink_remit_password@localhost:5432/golink_remit_db?schema=public";

export default defineConfig({
  earlyAccess: true,
  datasource: {
    url: dbUrl,
  },
  migrate: {
    async adapter() {
      const { PrismaPg } = await import('@prisma/adapter-pg');
      const { Pool } = await import('pg');
      
      const isLocal = dbUrl.includes('localhost') || dbUrl.includes('127.0.0.1') || dbUrl.includes('postgres');
      // Supabase connections require SSL, local postgres does not.
      const isSupabase = dbUrl.includes('supabase.com');
      
      const pool = new Pool({
        connectionString: dbUrl,
        ssl: isSupabase ? { rejectUnauthorized: false } : undefined,
      });
      return new PrismaPg(pool);
    },
  },
});
