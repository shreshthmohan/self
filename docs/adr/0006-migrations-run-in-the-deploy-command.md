# Migrations run in the deploy command, and are additive only

Deployment is the Cloudflare dashboard's GitHub connection — Workers Builds — which offers a build command and a deploy command and no test or release step between them. `wrangler d1 migrations apply` therefore has nowhere else to run. It rides the **deploy command**, through a checked-in `scripts/deploy.sh`, and every migration it applies is additive.

## Why the deploy command, not the build command

The deploy step is the step Cloudflare authenticates for wrangler, so a migration there inherits those credentials and no API token has to be stored. The build step has no such guarantee.

Sequencing follows: the script fails closed, so a failed migration exits non-zero and the Worker never uploads. The reverse order — upload first, migrate after — would put new code in front of an old schema.

A custom deploy command **replaces** the non-production default (`npx wrangler versions upload`), so the branch logic has to live in the script:

| Branch | `CLOUDFLARE_ENV` | Database | Deploy |
| --- | --- | --- | --- |
| `main` | `production` | `self` | `wrangler deploy` |
| `dev` | `dev` | `self-dev` | `wrangler deploy` |
| any other | `production` | none | `wrangler versions upload` |

## The environment is chosen at build time, not deploy time

This ADR first wrote the `dev` deploy as `wrangler deploy --env dev`. That is wrong, and it fails silently.

The React Router build flattens **one** wrangler environment into `build/server/wrangler.json`, and `wrangler deploy` deploys that file. The flattened file has no `env` block left, so `--env dev` on the deploy selects nothing and the deploy ships whatever the build resolved — production's bindings, production's worker name, and production's custom domain. Nothing errors.

So the branch has to reach the **build** command as well. `scripts/build.sh` maps the branch to `CLOUDFLARE_ENV`, and `scripts/deploy.sh` deploys what it built and passes no `--env`. Two scripts, one branch variable, read twice.

`d1 migrations apply` is the exception. It reads `wrangler.jsonc` directly rather than the build output, so it does honour `--env`, and the deploy script passes it.

Two guards follow from this, both in `wrangler.jsonc`. The top level is **local development only** and its `database_id` is a placeholder, so a build with no `CLOUDFLARE_ENV` cannot reach a real database and declares no route. And each named environment sets its own `name` — `self` and `self-dev` — so a misrouted deploy lands on a different worker instead of overwriting the live one.

`WORKERS_CI_BRANCH` is injected by Workers Builds and carries the branch name. `--remote` is mandatory on every `migrations apply`: without it the command writes a **local** file and exits 0, so the miss is silent.

The script is checked in rather than typed into the dashboard. An inline command is invisible to git and its `&&` / `||` precedence is a trap — a failed migration on `main` falls through to `||` and uploads a preview version instead of failing.

## Why additive only

A migration lands while the **old** Worker is still serving; the new Worker goes live after. For that window, old code runs against the new schema. So no column is dropped or renamed in the same deploy that stops using it, and a destructive change splits across two deploys: stop reading the column, ship, then drop it.

Nothing enforces this in code. A grep guard for `DROP COLUMN` and `RENAME` was rejected, because it blocks the legitimate second-deploy contraction unless it also grows an escape hatch. A single author reads every `drizzle-kit generate` output before committing it.

## Consequences

**Rollback rolls back the Worker version, never the migration.** Wrangler migrations are forward-only, and repair is a new additive migration. The additive rule is what makes this safe: the previous version's code still runs against the newer schema, and the extra column is inert. D1 Time Travel, which reaches back 30 days, stays the break-glass answer for corrupted **data**, not for schema.

**A preview version binds the production database.** That is why only two branches migrate. Every other branch still builds and uploads a preview, against production's schema — so a branch that needs a new column will 500 on its preview until it merges to `dev`. The breakage is loud and self-inflicted one commit earlier.

**`dev` is a wrangler environment, not a second Workers project.** One repository connection, one script, one dashboard surface; only the bindings differ. `dev` is the branch because CLAUDE.md already names it the base for worktrees.

**The ambient credential is verified.** It was assumed when this record was written, because Cloudflare publishes no scope for the deploy step's wrangler credential. The first migrated deploy to `main` proved it: the Workers Builds run of 2026-08-25 17:12 UTC applied `0000_initial_schema` and `0001_seed_reserved_paths` to D1 `self` and deployed the Worker. No `CLOUDFLARE_API_TOKEN` build secret is needed.

**Preview builds must be switched on, or the table above is dead code.** Cloudflare's production branch is `main`, and Workers Builds ships with non-production branch builds **off**. With that setting off, a push to any other branch runs nothing at all — so the `any other` row never fires, and neither does the `dev` row, because `dev` is a non-production branch too. The setting is now on. Verified on branch `deploy-guard`: the build uploaded a version, added no deployment, and left `self-dev` unmigrated.

Set in [How migrations run on Cloudflare Workers Builds](https://github.com/shreshthmohan/self/issues/23).
