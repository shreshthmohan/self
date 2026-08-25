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
 * The schema arrives as a parameter, not an import, so that
 * `auth-generate.config.ts` can build this config before the generated schema
 * file exists. Serving a real sign-in is #43's work, not this module's; the
 * Resend sender (ADR 0008) arrives through `sendMagicLink`.
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
}) {
	return betterAuth({
		database: drizzleAdapter(options.db, {
			provider: "sqlite",
			schema: options.schema,
		}),
		baseURL: options.baseURL,
		secret: options.secret,

		// Closed registration: an invited address signs in, nobody else. See #5.
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
					input: false, // Set by invitation, never by signing up.
				},
			},
		},

		plugins: [
			magicLink({
				// 300 s can die before a phone mail client fetches the URL.
				expiresIn: 60 * 15,
				sendMagicLink: async ({ email, url }) => {
					await options.sendMagicLink({ email, url });
				},
			}),
		],
	});
}

export type Auth = ReturnType<typeof createAuth>;
