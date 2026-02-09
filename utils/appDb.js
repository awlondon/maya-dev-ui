import { Pool } from 'pg';

let appDbPool = null;

export function getAppDbPool() {
  if (appDbPool) {
    return appDbPool;
  }
  const connectionString = process.env.APP_DATABASE_URL || process.env.DATABASE_URL;
  if (!connectionString) {
    return null;
  }
  appDbPool = new Pool({ connectionString });
  return appDbPool;
}
