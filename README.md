# self

A personal CMS on React Router v8, Cloudflare Workers, D1, and R2.

Decisions live in [`docs/adr/`](docs/adr/). Domain language lives in [`CONTEXT.md`](CONTEXT.md). The plan lives in [issue #1](https://github.com/shreshthmohan/self/issues/1).

## Develop

```sh
pnpm install
pnpm run dev
```

`pnpm run typecheck` and `pnpm run build` must both pass before you push.

## Test

```sh
pnpm run test
```

Playwright, end to end, against a real Worker and a real D1. There are no unit
tests and no mocks: what this codebase can get wrong is a route, and a route is
only wrong in a browser.

Every spec runs **twice** — once in a browser with JavaScript, once in a
browser with `javaScriptEnabled: false`. The second run is the point. An
untested no-JS path rots within a month and it rots silently, because every
developer runs with JavaScript on, so a route that works only after hydration
fails the build. See [ADR 0002](docs/adr/0002-progressive-enhancement-over-selective-hydration.md).
The flows covered are reading an entry, signing in, and saving one.

Playwright starts its own server, `scripts/e2e-server.sh`. It is not
`pnpm run dev`:

- It runs the `e2e` wrangler environment on **port 5273**, so a dev server on
  5173 can stay up. `BETTER_AUTH_URL` names one origin and auth 404s on every
  other (ADR 0012), so the suite needs an origin of its own.
- Its local D1 lives in `.wrangler/e2e-state`, and it is **wiped on every
  start**. The owner claim happens once in the life of a database and the
  magic-link counter is per hour, so a run that inherits the last run's rows is
  a run that cannot sign in.
- It writes `.dev.vars.e2e`, which is the suite's own throwaway secret.
  `.dev.vars` is left alone.
- It tees its stdout to `tests/.tmp/dev.log`. A local sign-in prints the magic
  link to the Worker console instead of sending mail, and `tests/magic-link.ts`
  reads the URL back out of that log. There is no mailbox to poll, and no code
  in the app changes to let the suite sign in.

A failing run leaves an HTML report and a trace in `tests/.tmp/report`.

CI runs `typecheck`, `build`, and `test` on every push
([`.github/workflows/ci.yml`](.github/workflows/ci.yml)).

## Environment variables

Nothing here belongs in a Workers Builds **build variable**: a build variable is read while the build runs, and every value below is read while a request runs.

| Name                 | What it is                                             | Where it comes from            |
| -------------------- | ------------------------------------------------------ | ------------------------------ |
| `BETTER_AUTH_SECRET` | Signs session tokens. Rotating it signs everybody out. | Generate one. A secret.        |
| `RESEND_API_KEY`     | Sends the magic link. One key per environment.         | The Resend dashboard. A secret.|
| `BETTER_AUTH_URL`    | The one origin auth answers on.                        | `wrangler.jsonc`. A plain var. |

The secret **names** are declared in `wrangler.jsonc` under `secrets.required`,
in every environment block. `wrangler types` writes the types from that list
instead of inferring them from a `.dev.vars` file, so `pnpm run typecheck`
passes on a clean checkout that has none — which is what CI is. The values stay
out of the repo.

`BETTER_AUTH_URL` is not a secret and is checked in, one value per environment. It is a written value and not an inferred one because a version preview URL is public and carries **production** bindings: an origin read off the request would make every preview a second front door to the production database. Auth 404s on any other origin. See [ADR 0012](docs/adr/0012-the-first-sign-in-claims-the-site.md).

### Generate the auth secret

```sh
openssl rand -base64 32
```

Generate a **different** value for each environment. A shared secret makes a `dev` session valid in production.

### Set them on Cloudflare

A secret is per environment, so each one is set twice. The default environment is production; `--env dev` is the `dev` environment.

```sh
# Production, deployed from `main`
pnpm exec wrangler secret put BETTER_AUTH_SECRET
pnpm exec wrangler secret put RESEND_API_KEY

# Dev, deployed from `dev`
pnpm exec wrangler secret put BETTER_AUTH_SECRET --env dev
pnpm exec wrangler secret put RESEND_API_KEY --env dev
```

Each command prompts for the value and never writes it to disk. To read a value from a file or a password manager instead of typing it:

```sh
op read "op://Private/self/BETTER_AUTH_SECRET" | pnpm exec wrangler secret put BETTER_AUTH_SECRET
```

Confirm what is set. The command lists names, never values:

```sh
pnpm exec wrangler secret list
pnpm exec wrangler secret list --env dev
```

Remove one:

```sh
pnpm exec wrangler secret delete RESEND_API_KEY --env dev
```

### Set them locally

Local runs read `.dev.vars`, not `wrangler secret`. Copy the example and fill it in:

```sh
cp .dev.vars.example .dev.vars
```

`.dev.vars` is ignored by git. Never commit it. Local sign-in prints the magic link to the console instead of sending mail, so `RESEND_API_KEY` can hold any placeholder there.

## Sign in

The site has one owner, and **the first address to sign in claims it**. Registration closes behind that address: a later unknown address receives no mail and sees the same notice as a known one. See [ADR 0012](docs/adr/0012-the-first-sign-in-claims-the-site.md).

The claim window opens when a bundle deploys to a database with no owner in it, and it closes on the first sign-in. Anybody who reaches `/api/auth/sign-in/magic-link` inside that window becomes the owner, so **deploy and then claim at once**, and read the table afterwards:

```sh
pnpm exec wrangler d1 execute self --remote \
  --command "SELECT email, role FROM user"
```

`/login` is linked from nowhere. A magic link always lands on `/`, so no redirect parameter is carried and none has to be validated. Logging out is a POST, never a GET.

Locally there is no mail: `pnpm run dev` prints the magic link to the Worker console and the URL is pasted into the browser. The claim works the same way there, against the local database.

## Schema and migrations

One TypeScript file is the source: [`app/db/schema.ts`](app/db/schema.ts). Nothing writes to D1 except a migration wrangler applies.

```sh
pnpm run db:generate      # schema.ts -> a new file in migrations/
pnpm run auth:generate    # Better Auth's five tables -> app/db/auth-schema.ts
```

`app/db/auth-schema.ts` is **generated, never hand-edited**. An upgrade is: regenerate, read the diff, `pnpm run db:generate`, commit. See [ADR 0010](docs/adr/0010-auth-tables-live-in-the-app-schema.md).

Apply locally with wrangler:

```sh
pnpm exec wrangler d1 migrations apply self-dev --local
```

`dev` and `main` apply theirs from `scripts/deploy.sh`, so a failed migration stops the deploy. `d1 migrations apply` is the one command that reads `wrangler.jsonc` and honours `--env`.

**Migrations are additive only.** A migration lands while the old worker is still serving, so no column is dropped or renamed in the deploy that stops using it. Split a destructive change across two deploys. Nothing enforces this — read every `db:generate` diff.

Reach the database through `createDb()` in [`app/db/index.ts`](app/db/index.ts), never `drizzle()` directly. The wrapper hides `transaction()`, which D1 auto-commits straight through; `batch()` is the only transactional unit.

## Deploy

Cloudflare Workers Builds deploys on a push. The dashboard settings are:

| Setting           | Value                  |
| ----------------- | ---------------------- |
| Build command     | `sh scripts/build.sh`  |
| Deploy command    | `sh scripts/deploy.sh` |
| Root directory    | `/`                    |
| Production branch | `main`                 |

Both commands are scripts, because the branch has to reach both steps.

`scripts/build.sh` maps the pushed branch to `CLOUDFLARE_ENV`: `dev` builds the `dev` environment, everything else builds `production`. This matters more than it looks. The React Router build flattens **one** wrangler environment into `build/server/wrangler.json`, so the environment is fixed at build time and `wrangler deploy --env dev` selects nothing.

`scripts/deploy.sh` then migrates and deploys what the build produced: `main` migrates D1 `self` and deploys; `dev` migrates `self-dev` and deploys; every other branch uploads a preview version and migrates nothing. See [ADR 0006](docs/adr/0006-migrations-run-in-the-deploy-command.md).

## Domains

| Environment | Worker     | Domain             |
| ----------- | ---------- | ------------------ |
| production  | `self`     | `shreshth.dev`     |
| dev         | `self-dev` | `dev.shreshth.dev` |

Both are custom domains in `wrangler.jsonc`. Wrangler writes the DNS record on the first deploy; neither name had a record before.

Local development uses the top level of `wrangler.jsonc`, whose `database_id` is a placeholder on purpose. A build with no `CLOUDFLARE_ENV` therefore cannot reach a real database and claims no domain.
