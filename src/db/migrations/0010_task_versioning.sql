-- Migration: 0010_task_versioning.sql
-- Description: Adds monotonic integer version column to todos for deterministic stale event rejection

ALTER TABLE "todos" ADD COLUMN IF NOT EXISTS "version" integer DEFAULT 1 NOT NULL;
