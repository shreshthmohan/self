# The first sign-in claims the site

The first address to sign in becomes the `owner`. Registration closes behind it: every later unknown address is refused, and no form ever sets a role.

This replaces the bootstrap paragraph in [The auth tables live in the app schema](./0010-auth-tables-live-in-the-app-schema.md), which said the first user would be promoted by hand with one `wrangler d1 execute`. That paragraph assumed sign-up was open at least once and never said what closed it afterwards.

## Why not a seeded owner

A hand-written migration could insert the owner row — email, id, `role = 'owner'` — the way `0001` hand-writes the reserved words. There would then be no window in which an unknown address could claim anything.

It was rejected because it puts an address in a migration, which is a file that runs on every database this schema ever builds. A second site, a restored copy, or a local database all get the same owner, and changing it is a second migration rather than a sign-in. The claim keeps the owner a fact of the database, not of the source tree.

Holding the owner in an `OWNER_EMAIL` secret was rejected again, for the reason [ADR 0010](./0010-auth-tables-live-in-the-app-schema.md) gave the first time: it makes "who is the owner" unanswerable in SQL.

## The cost is a window

Between the deploy going live and the claim, any address that reaches `/api/auth/sign-in/magic-link` becomes **owner** — not a harmless viewer. This is accepted because nothing is behind that door yet and the window is one deploy long: deploy, then sign in at once.

It is a window, not a hole, and it is worth saying plainly rather than designing around. The alternative that removes it is the seeded owner, and its cost is permanent where this one lasts a minute.

## Two gates, both in the auth config

Neither gate lives in the `/login` route. `/api/auth/sign-in/magic-link` is reachable directly, so a gate in a route of ours would not cover it.

**At send time**, `sendMagicLink` refuses an address that is neither known nor the claim. `disableSignUp` is *not* this gate: better-auth reads that option only when a link is **verified**, so with it set an unknown address still receives a working-looking mail and fails on the click. That is a Resend send on the owner's bill for every address a stranger types. Refusing to send means the address receives nothing, while the caller is told the same thing either way — one generic notice, no existence oracle ([ADR 0003](./0003-visibility-is-derived.md)).

**At create time**, a `databaseHooks.user.create.before` hook returns `false` once an owner exists, and otherwise stamps `role: "owner"` on the row it is about to write. It is the only place a role is decided.

## The claim races, so the database settles it

The hook reads "is there an owner" and then writes one. D1 auto-commits and `batch()` does not span a Better Auth write, so two sign-ins against an empty table can both read no owner.

`migrations/0002_one_owner.sql` carries a partial unique index on `role = 'owner'`. The loser fails its insert instead of minting a second owner. The index is hand-written rather than generated: `app/db/auth-schema.ts` is written by `auth generate` and never edited ([ADR 0010](./0010-auth-tables-live-in-the-app-schema.md)).

## Consequences

**The local owner shortcut is gone.** `getViewer` returned a `LOCAL_OWNER` under `import.meta.env.DEV`. Local now signs in for real, off the URL the Worker console prints ([ADR 0008](./0008-resend-sends-the-magic-link.md)), so there is one way to become the owner and production exercises it. The standing rule that "a deployed bundle can never produce an owner" is retired with it — a deployed bundle produces an owner exactly once, on purpose, and the two gates and the index are what bound it.

**`getViewer` is async.** A session read is a database read. Every caller awaits it. The seam was declared synchronous while it was a stub.

**Auth answers on one origin.** `BETTER_AUTH_URL` is set per environment and the handler refuses any other origin. A version preview URL is public and carries production bindings, so an inferred `baseURL` would make every preview a second front door to the production database. `workers_dev` is off for the same reason. The refusal is the same generic notice as a bad slug.

**Magic-link tokens are stored hashed.** `storeToken: "hashed"`, against the `"plain"` default. D1 Time Travel and every backup hold the `verification` table.

Set in [Prove better-auth/minimal serves a real sign-in on Workers](https://github.com/shreshthmohan/self/issues/43).
