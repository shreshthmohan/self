#!/bin/sh
# The dev server the Playwright suite drives. Playwright starts it and stops
# it; nobody runs this by hand.
#
# It is not `pnpm run dev`. Four things differ, and each one is why the suite
# can run at all.
#
#   1. The `e2e` wrangler environment, on port 5273. `BETTER_AUTH_URL` names
#      ONE origin and auth 404s on every other (ADR 0012), so the suite needs
#      an origin of its own to leave the developer's dev server alone.
#   2. A state directory of its own, `.wrangler/e2e-state`. A run wipes the
#      suite's local D1 and never the database `pnpm run dev` writes.
#   3. A wipe on every start. The owner claim happens once in the life of a
#      database (ADR 0012) and the magic-link counter is per hour (ADR 0013),
#      so a run that inherits the last run's rows is a run that cannot sign in.
#   4. Stdout on disk. A local sign-in prints the magic link to the Worker
#      console instead of sending mail, and `tests/magic-link.ts` reads the URL
#      back out of this log.
set -eu

state_dir=".wrangler/e2e-state"
log="tests/.tmp/dev.log"

# `.dev.vars.e2e` holds BETTER_AUTH_SECRET, which the Worker reads on every
# session. Wrangler prefers it over `.dev.vars` while CLOUDFLARE_ENV is `e2e`,
# so this file is the suite's alone and the developer's secrets are untouched.
# It is rewritten every run: a throwaway secret signs out a stale session,
# which is what a fresh database wants anyway.
printf 'BETTER_AUTH_SECRET="%s"\nRESEND_API_KEY="e2e-placeholder"\n' \
	"$(openssl rand -base64 32)" >.dev.vars.e2e

rm -rf "$state_dir"
mkdir -p "$(dirname "$log")"
: >"$log"
# A crashed run can leave the sign-in lock behind. See tests/sign-in-lock.ts.
rm -rf tests/.tmp/sign-in.lock

# `--local`, and against the suite's own directory. The Vite plugin reads the
# same layout, so the file this migrates is the file the Worker opens.
pnpm exec wrangler d1 migrations apply self-e2e --env e2e --local \
	--persist-to "$state_dir"

# `tee`, not a redirect: Playwright watches this stdout to learn the server is
# up, and the magic-link helper polls the copy on disk.
CLOUDFLARE_ENV=e2e E2E_STATE_DIR="$state_dir" pnpm run dev 2>&1 | tee "$log"
