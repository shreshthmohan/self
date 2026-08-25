# Migrations run in the deploy command, and are additive only

Deployment is the Cloudflare dashboard's GitHub connection — Workers Builds — which offers a build command and a deploy command and no test or release step between them. `wrangler d1 migrations apply` therefore has nowhere else to run. It rides the **deploy command**, through a checked-in `scripts/deploy.sh`, and every migration it applies is additive.

## Why the deploy command, not the build command

The deploy step is the step Cloudflare authenticates for wrangler, so a migration there inherits those credentials and no API token has to be stored. The build step has no such guarantee.

Sequencing follows: the script fails closed, so a failed migration exits non-zero and the Worker never uploads. The reverse order — upload first, migrate after — would put new code in front of an old schema.

A custom deploy command **replaces** the non-production default (`npx wrangler versions upload`), so the branch logic has to live in the script:

| Branch | Database | Deploy |
| --- | --- | --- |
| `main` | `self` | `wrangler deploy` |
| `dev` | `self-dev` | `wrangler deploy --env dev` |
| any other | none | `wrangler versions upload` |

`WORKERS_CI_BRANCH` is injected by Workers Builds and carries the branch name. `--remote` is mandatory on every `migrations apply`: without it the command writes a **local** file and exits 0, so the miss is silent.

The script is checked in rather than typed into the dashboard. An inline command is invisible to git and its `&&` / `||` precedence is a trap — a failed migration on `main` falls through to `||` and uploads a preview version instead of failing.

## Why additive only

A migration lands while the **old** Worker is still serving; the new Worker goes live after. For that window, old code runs against the new schema. So no column is dropped or renamed in the same deploy that stops using it, and a destructive change splits across two deploys: stop reading the column, ship, then drop it.

Nothing enforces this in code. A grep guard for `DROP COLUMN` and `RENAME` was rejected, because it blocks the legitimate second-deploy contraction unless it also grows an escape hatch. A single author reads every `drizzle-kit generate` output before committing it.

## Consequences

**Rollback rolls back the Worker version, never the migration.** Wrangler migrations are forward-only, and repair is a new additive migration. The additive rule is what makes this safe: the previous version's code still runs against the newer schema, and the extra column is inert. D1 Time Travel, which reaches back 30 days, stays the break-glass answer for corrupted **data**, not for schema.

**A preview version binds the production database.** That is why only two branches migrate. Every other branch still builds and uploads a preview, against production's schema — so a branch that needs a new column will 500 on its preview until it merges to `dev`. The breakage is loud and self-inflicted one commit earlier.

**`dev` is a wrangler environment, not a second Workers project.** One repository connection, one script, one dashboard surface; only the bindings differ. `dev` is the branch because CLAUDE.md already names it the base for worktrees.

**The ambient credential is assumed, not verified.** Cloudflare publishes no scope for the deploy step's wrangler credential. The first migrated deploy to `main` proves it. If it fails, the fix is one `CLOUDFLARE_API_TOKEN` build secret, scoped Workers Scripts:Edit and D1:Edit.

Set in [How migrations run on Cloudflare Workers Builds](https://github.com/shreshthmohan/self/issues/23).
