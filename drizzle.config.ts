import { defineConfig } from "drizzle-kit";

/**
 * `drizzle-kit generate` only. It writes SQL into `migrations/`, which is
 * wrangler's `migrations_dir`; wrangler alone applies it, from
 * `scripts/deploy.sh`. See ADR 0006.
 *
 * There is no `dbCredentials` block and no `push`, `pull`, or `studio` here on
 * purpose: every one of those wants a live connection, and a second tool that
 * can write to D1 is a second way to get a schema nobody generated.
 */
export default defineConfig({
	dialect: "sqlite",
	schema: "./app/db/schema.ts",
	out: "./migrations",
	casing: "snake_case",
	verbose: true,
	strict: true,
});
