/**
 * Entry point for the Better Auth generate CLI only. Not imported by the app.
 *
 * The CLI needs a top-level `auth` export to read the table shape from. The
 * real config is `app/lib/auth.ts`, which takes its database and secrets at
 * request time and so cannot be built by a Node CLI. This file feeds it stubs.
 *
 * Regenerate with:  pnpm run auth:generate
 * Then read the diff and run `pnpm run db:generate`. Never hand-edit
 * `app/db/auth-schema.ts`. See ADR 0010.
 */
import { createAuth } from "./app/lib/auth";

export const auth = createAuth({
	db: {},
	schema: {},
	baseURL: "http://localhost:5173",
	secret: "generate-only-never-used",
	sendMagicLink: async () => {},

	// The two gates on the owner claim. They read the database, which this CLI
	// does not have, and they decide nothing about the TABLE SHAPE the CLI is
	// here to read — so they are stubs, like the database above.
	isRegistrationClosed: async () => false,
	isKnownAddress: async () => false,

	// The per-address rate-limit counter (ADR 0013). It reads and writes
	// `rate_limit`, a table better-auth already declares, so it adds no shape of
	// its own for the CLI to read — another stub.
	consumeAddressAllowance: async () => true,
});
