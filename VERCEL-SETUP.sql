-- Run once in the SAME Neon database used by both Vercel deployments.
-- The existing LYCA tables are created by POSTGRESQL-SETUP.sql.
-- This additional table keeps administrator login limits across server instances.
CREATE SCHEMA IF NOT EXISTS lyca;
CREATE TABLE IF NOT EXISTS lyca.admin_login_attempts (
  bucket text PRIMARY KEY,
  window_start timestamptz NOT NULL DEFAULT now(),
  attempts integer NOT NULL DEFAULT 0
);
