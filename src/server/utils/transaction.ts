import { type Database, type DbExecutor } from "@/db";

/**
 * Executes an operation within a database transaction if a live database connection
 * is configured; otherwise executes directly (e.g. in mocked unit tests).
 */
export async function withTransaction<T>(
  db: Database | null | undefined,
  fn: (tx?: DbExecutor) => Promise<T>
): Promise<T> {
  if (process.env.DATABASE_URL && db) {
    try {
      if (typeof db.transaction === "function") {
        return await db.transaction(async (tx) => fn(tx));
      }
    } catch (err: any) {
      if (err?.name === "DatabaseConfigurationError") {
        return fn(undefined);
      }
      throw err;
    }
  }
  return fn(undefined);
}

