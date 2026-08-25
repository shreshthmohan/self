# The auth tables live in the app schema

Better Auth runs on `better-auth/minimal` with the Drizzle adapter. Its four tables — `user`, `session`, `account`, `verification` — are declared in the same Drizzle schema as `entry`, `contact`, and the rest, and they migrate through the same `drizzle-kit generate` pipeline.

The documented path is the other one. Since 1.5 Better Auth ships a built-in D1 dialect, and `betterAuth({ database: env.DB })` is all it asks for. That path is rejected here.

## Why not the built-in dialect

`kysely` is a hard dependency of `better-auth`, not a peer, so Kysely ships whatever access layer the app picks. The default entry imports the Kysely adapter statically. Adding `drizzleAdapter` on top of that entry is the worst arrangement of all — 224 KB gzip, Kysely still resident and Drizzle added beside it. Only `better-auth/minimal` removes Kysely: 173 KB gzip against 201 KB for the built-in dialect.

The 27.7 KB is not the argument. [Choose the D1 access layer](https://github.com/shreshthmohan/self/issues/11) already ruled Worker-side bytes near-irrelevant, and both figures sit far inside the 3 MB Workers limit. Two things decide it instead.

**The app queries the `user` table.** [Visibility is derived](./0003-visibility-is-derived.md) puts a nullable `user_id` on a contact and `*_user` access rows on every shareable record. Every visibility check joins `user`. Under the built-in dialect that table is invisible to Drizzle, so each join is either hand-written SQL or a second declaration of `user` in the Drizzle schema — one table with two definitions, free to drift, and the drift surfaces as a runtime error inside Better Auth rather than as a failed migration.

**One migration route.** The built-in dialect's compensation is `getMigrations` from `better-auth/db/migration`, which the Drizzle adapter forfeits. It is not worth keeping. It needs a build-time Node step that runs a D1 shim and introspects a live database, and whether it emits stable, diff-able files beside the app's own migrations was never established. `drizzle-kit generate` already writes into the wrangler migrations directory, and [migrations run in the deploy command](./0006-migrations-run-in-the-deploy-command.md) already applies them.

The cost is that `better-auth/minimal` is thinly documented. What it gives up besides adapter detection is not written down anywhere, and is proved only by a real sign-in on Workers.

## The schema file is generated, never hand-edited

`npx auth generate` writes the four tables as Drizzle declarations. That file is checked in as its own module and no one edits it. App tables import from it for their foreign keys.

Hand-writing the four tables from the DDL was rejected. It reads the same on the day it is written and drifts on the first Better Auth upgrade, silently.

An upgrade is therefore: regenerate, read the diff, `drizzle-kit generate`, commit. The output is an ordinary migration and the additive-only rule of ADR 0006 governs it like any other. If Better Auth ever drops or renames a column, that change splits across two deploys.

## Roles are one column

`user.additionalFields` adds `role text` with no plugin, and `input: false` stops sign-up from setting it. The vocabulary is `owner` and `viewer`, closed in TypeScript and not in D1 — the rule [What 'kind' is on an entry](https://github.com/shreshthmohan/self/issues/3) set, for the same reason: SQLite cannot alter a `CHECK`, so a database-level enum makes every new value a table rebuild.

The `admin` plugin costs 5,580 B gzip and buys ban, impersonate, and set-role. Registration is closed and every viewer is invited by the owner, so there are no strangers to moderate.

Holding the owner in an `OWNER_EMAIL` secret instead of a column was rejected: it makes "who is the owner" unanswerable in SQL, so any owner-aware listing has to leave the database to resolve it.

The price is a bootstrap step. `input: false` blocks the first sign-up from setting its own role, so the first user is promoted by one manual `wrangler d1 execute` against `self`.

## Consequences

**The first migration waits on the session store.** [Session storage and revocation lag](https://github.com/shreshthmohan/self/issues/26) can choose `secondaryStorage`, which removes `session` and `verification` from the generated schema. Generating the auth schema before that answer, then dropping two tables after it, is exactly the destructive migration ADR 0006 forbids in one deploy. No code is written yet, so the wait costs nothing.

**Auth rows and app rows can join one `batch()`.** They are one access layer now. This does not make Better Auth's own writes atomic — those stay single auto-committed statements, and the 1.5 release note's claim of `batch()` atomicity is not borne out by its code — but a flow the app writes itself, such as attaching a `contact` to a new `user`, can land as one batch.

Facts in `docs/research/better-auth-d1.md`. Set in [Better Auth adapter: built-in D1 dialect or minimal plus Drizzle](https://github.com/shreshthmohan/self/issues/24).
