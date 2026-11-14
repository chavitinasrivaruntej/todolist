import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "./schema";

/**
 * Global cache to prevent multiple client instances during Next.js hot reloads in development.
 */
declare global {
  // eslint-disable-next-line no-var
  var __dbClient: postgres.Sql | undefined;
}

// Fallback to placeholder during build time if environment variable is not yet set
const connectionString =
  process.env.DATABASE_URL ||
  "postgresql://postgres:placeholder@db.placeholder.supabase.co:5432/postgres";

// Supabase PostgreSQL connection with pooling options
const client =
  globalThis.__dbClient ??
  postgres(connectionString, {
    prepare: false, // Disabling prepared statements for compatibility with transaction poolers (PgBouncer)
    max: 10,
    idle_timeout: 20,
    connect_timeout: 10,
  });

if (process.env.NODE_ENV !== "production") {
  globalThis.__dbClient = client;
}

export const db = drizzle(client, { schema });
export type Database = typeof db;
