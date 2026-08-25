import { env } from "cloudflare:workers";
import { eq, sql } from "drizzle-orm";

import * as schema from "../db/schema";
import { user } from "../db/schema";
import { createAuth, type Auth } from "./auth";
import { db } from "./db.server";
import { sendMagicLinkEmail } from "./email.server";

/**
 * The Better Auth instance for this isolate.
 *
 * Built lazily, never at module scope: `env` carries secrets that are only
 * readable inside a request on Workers.
 */
let instance: Auth | undefined;

export function auth(): Auth {
	if (instance) return instance;

	const database = db();

	instance = createAuth({
		db: database,
		schema,
		baseURL: env.BETTER_AUTH_URL,
		secret: env.BETTER_AUTH_SECRET,
		sendMagicLink: sendMagicLinkEmail,

		isRegistrationClosed: async () => {
			const rows = await database
				.select({ n: sql<number>`count(*)` })
				.from(user)
				.where(eq(user.role, "owner"))
				.limit(1);
			return (rows[0]?.n ?? 0) > 0;
		},

		isKnownAddress: async (email) => {
			const rows = await database
				.select({ id: user.id })
				.from(user)
				.where(eq(user.email, email))
				.limit(1);
			return rows.length > 0;
		},
	});

	return instance;
}

/**
 * The origin guard.
 *
 * `scripts/build.sh` maps every branch except `dev` to production and
 * `scripts/deploy.sh` uploads a version for every branch except `main` and
 * `dev`, so a version preview URL is PUBLIC and carries PRODUCTION bindings.
 * Auth answers on the configured origin and nowhere else; a preview stays
 * readable and cannot mint a session or send a magic link.
 *
 * The refusal is the same generic notice as a bad slug. See ADR 0003.
 */
export function isAuthOrigin(request: Request): boolean {
	return new URL(request.url).origin === new URL(env.BETTER_AUTH_URL).origin;
}
