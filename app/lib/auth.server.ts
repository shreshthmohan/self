import { env } from "cloudflare:workers";
import { eq, sql } from "drizzle-orm";

import * as schema from "../db/schema";
import { rateLimit, user } from "../db/schema";
import { createAuth, type Auth } from "./auth";
import { db } from "./db.server";
import { sendMagicLinkEmail } from "./email.server";

/**
 * Five sends per address per hour. A real sign-in is one mail, and a person who
 * does not receive it retries once or twice; five leaves room for that and
 * still bounds a flood at 120 mails a day to one mailbox. See ADR 0013.
 */
const MAX_PER_WINDOW = 5;
const WINDOW_MS = 60 * 60 * 1000;

/**
 * The counter shares better-auth's own `rate_limit` table — its three columns
 * are exactly this shape, so a second table would hold the same three under a
 * different name. The namespace keeps the two key spaces apart: better-auth
 * builds `<ip>|<path>`, which cannot collide with this.
 *
 * `app/db/auth-schema.ts` is generated and read on every upgrade, so a change
 * to that table's meaning arrives as a visible diff rather than silently.
 */
const addressKey = (email: string) => `magic-link-email|${email}`;

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

		consumeAddressAllowance: async (email) => {
			const now = Date.now();

			try {
				// One statement, so two concurrent requests cannot both read the
				// same count and both write it back. D1 has no interactive
				// transaction to hold a read-then-write open across.
				//
				// A FIXED window, the same shape better-auth's own limiter uses:
				// the three columns of `rate_limit` are exactly enough for it. A
				// burst straddling a reset can land ten in a little over an hour,
				// which is the price of not forking the table for a rolling window.
				const rows = await database
					.insert(rateLimit)
					.values({
						id: crypto.randomUUID(),
						key: addressKey(email),
						count: 1,
						lastRequest: now,
					})
					.onConflictDoUpdate({
						target: rateLimit.key,
						set: {
							count: sql`case when ${now} - ${rateLimit.lastRequest} > ${WINDOW_MS} then 1 else ${rateLimit.count} + 1 end`,
							lastRequest: sql`${now}`,
						},
					})
					.returning({ count: rateLimit.count });

				return (rows[0]?.count ?? 1) <= MAX_PER_WINDOW;
			} catch (error) {
				// FAIL OPEN. The same D1 backs the address gate and every session
				// read, so an outage has already broken sign-in; refusing here adds
				// no protection and turns a partial outage into a silent lockout of
				// the only person who can fix it. The address is never logged.
				console.error("magic link: rate-limit counter failed", error);
				return true;
			}
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
