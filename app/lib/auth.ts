import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { betterAuth } from "better-auth/minimal";
import { magicLink } from "better-auth/plugins/magic-link";

import { ROLES } from "../db/vocabulary";

/**
 * Better Auth on `better-auth/minimal` with the Drizzle adapter, so its tables
 * are declared in the app's Drizzle schema and migrate through
 * `drizzle-kit generate` like any other table. See ADR 0010.
 *
 * Session policy: no `cookieCache`, no `secondaryStorage`. Every authenticated
 * request reads D1, so revocation is immediate. See ADR 0009.
 *
 * The schema and the two gates arrive as parameters, not imports, so that
 * `auth-generate.config.ts` can build this config before the generated schema
 * file exists and without a database. The Resend sender (ADR 0008) arrives the
 * same way, through `sendMagicLink`.
 */
export function createAuth(options: {
	// The Drizzle database and the schema it was built over. Typed from the
	// adapter rather than from `drizzle-orm/d1`: pinning D1 here would drag the
	// Workers types into a file the generate CLI runs under Node.
	db: Parameters<typeof drizzleAdapter>[0];
	schema: Record<string, unknown>;
	baseURL: string;
	secret: string;
	sendMagicLink: (args: { email: string; url: string }) => Promise<void>;

	/** True once the site has an owner. Registration is closed from then on. */
	isRegistrationClosed: () => Promise<boolean>;

	/** Whether a `user` row already holds this address. */
	isKnownAddress: (email: string) => Promise<boolean>;
}) {
	return betterAuth({
		database: drizzleAdapter(options.db, {
			provider: "sqlite",
			schema: options.schema,
		}),
		baseURL: options.baseURL,
		secret: options.secret,

		// The only origin that may mint a session. A version preview URL is
		// public and runs with PRODUCTION bindings (see scripts/build.sh), so
		// letting this be inferred from the request would make every preview a
		// second front door to the production database.
		trustedOrigins: [options.baseURL],

		// Closed registration: an invited address signs in, nobody else. See #5.
		// Password sign-up is closed outright — the owner claim is a magic link.
		emailAndPassword: { enabled: true, disableSignUp: true },

		session: {
			expiresIn: 60 * 60 * 24 * 30, // 30 days — sign-in is a magic link.
			updateAge: 60 * 60 * 24, // 1 day — this, not expiresIn, sets writes.
		},

		// Memory rate limiting is per-isolate on Workers, so it is decorative.
		rateLimit: { enabled: true, storage: "database" },

		user: {
			additionalFields: {
				role: {
					type: ROLES as unknown as string[],
					required: true,
					defaultValue: "viewer",
					input: false, // Set by the claim or by invitation, never by a form.
				},
			},
		},

		/**
		 * The SECOND gate on the owner claim, and the only place a role is
		 * decided. The first address to sign in claims the site and becomes its
		 * owner; every later unknown address is refused.
		 *
		 * Both gates live in this config rather than in the `/login` route,
		 * because `/api/auth/sign-in/magic-link` is reachable directly and a
		 * gate in a route of ours would not cover it.
		 *
		 * The read races the write: two sign-ins against an empty table both see
		 * no owner, and D1 has no transaction to hold between them.
		 * `migrations/0002_one_owner.sql` carries a partial unique index on
		 * `role = 'owner'`, so the loser fails its insert instead of minting a
		 * second owner. See ADR 0012.
		 */
		databaseHooks: {
			user: {
				create: {
					before: async (user) => {
						if (await options.isRegistrationClosed()) return false;
						return { data: { ...user, role: "owner" } };
					},
				},
			},
		},

		plugins: [
			magicLink({
				// 300 s can die before a phone mail client fetches the URL.
				expiresIn: 60 * 15,

				// A leaked `verification` row cannot be redeemed. D1 Time Travel
				// and every backup hold that table.
				storeToken: "hashed",

				/**
				 * The FIRST gate. `disableSignUp` is not it: better-auth reads
				 * that option only when a link is VERIFIED, so with it set an
				 * unknown address still receives a working-looking mail and fails
				 * on the click. Refusing to send means it receives nothing.
				 *
				 * The caller is told the same thing either way — one generic
				 * notice, no existence oracle. See ADR 0003.
				 */
				sendMagicLink: async ({ email, url }) => {
					const known = await options.isKnownAddress(email);
					if (!known && (await options.isRegistrationClosed())) return;
					await options.sendMagicLink({ email, url });
				},
			}),
		],
	});
}

export type Auth = ReturnType<typeof createAuth>;
