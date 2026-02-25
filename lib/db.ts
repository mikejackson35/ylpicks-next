import { Pool } from "pg";

// Singleton pool — prevents "too many connections" during Next.js hot reload in dev
const globalForPg = globalThis as unknown as { pgPool: Pool | undefined };

export const pool =
  globalForPg.pgPool ??
  new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false },
    max: 10,
  });

if (process.env.NODE_ENV !== "production") {
  globalForPg.pgPool = pool;
}
