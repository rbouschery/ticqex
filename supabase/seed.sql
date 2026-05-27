-- Runs on `pnpm db:reset`: bootstrap (required) + optional demo data.
-- Admin user is separate: `pnpm db:seed-admin` (optional).

\ir bootstrap.sql
\ir seed-demo.sql
