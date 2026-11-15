import { drizzle, PostgresJsDatabase } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "./schema";
import { DatabaseConfigurationError } from "@/server/errors";

declare global {
  // eslint-disable-next-line no-var
  var __dbInstance: PostgresJsDatabase<typeof schema> | undefined;
}

/**
 * Validates that DATABASE_URL is present and does not contain unresolved placeholders.
 * Never prints the raw connection string or credentials to logs or error messages.
 */
function getConnectionString(): string {
  const url = process.env.DATABASE_URL?.trim();

  if (!url) {
    throw new DatabaseConfigurationError(
      "DATABASE_URL is not set. Please configure a valid PostgreSQL connection string in .env.local."
    );
  }

  if (
    url.includes("[YOUR_DB_PASSWORD]") ||
    url.includes("[YOUR-PASSWORD]") ||
    url.includes("placeholder")
  ) {
    throw new DatabaseConfigurationError(
      "DATABASE_URL contains an unconfigured placeholder. Please replace [YOUR_DB_PASSWORD] with your actual Supabase database password in .env.local."
    );
  }

  return url;
}

/**
 * Lazily creates or returns the singleton Drizzle database instance.
 * Ensures the build phase can evaluate routes without a live DB connection,
 * while throwing clear configuration errors at runtime when queries are executed.
 */
function getDatabase(): PostgresJsDatabase<typeof schema> {
  if (globalThis.__dbInstance) {
    return globalThis.__dbInstance;
  }

  const connectionString = getConnectionString();

  const client = postgres(connectionString, {
    prepare: false, // Disabling prepared statements for compatibility with transaction poolers (PgBouncer)
    max: 10,
    idle_timeout: 20,
    connect_timeout: 10,
  });

  const instance = drizzle(client, { schema });

  if (process.env.NODE_ENV !== "production") {
    globalThis.__dbInstance = instance;
  }

  return instance;
}

/**
 * Proxy object exposing the Drizzle database interface.
 * Defers connection validation until a database method (e.g. select, insert, delete) is invoked.
 */
export const db = new Proxy({} as PostgresJsDatabase<typeof schema>, {
  get(_target, prop, receiver) {
    const realDb = getDatabase();
    const value = Reflect.get(realDb, prop, receiver);
    return typeof value === "function" ? value.bind(realDb) : value;
  },
});

export type Database = PostgresJsDatabase<typeof schema>;
export type DbExecutor = Database | Parameters<Parameters<Database["transaction"]>[0]>[0];
