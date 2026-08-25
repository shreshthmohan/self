#!/bin/sh
# Workers Builds deploy command. See docs/adr/0006-migrations-run-in-the-deploy-command.md.
#
# Migrations ride this step because it is the step Cloudflare authenticates
# for wrangler. The script fails closed: a failed migration exits non-zero and
# the Worker never uploads.
#
# --remote is mandatory. Without it the migration writes a local file and
# exits 0, so the miss is silent.
#
# `d1 migrations apply` reads wrangler.jsonc and honours --env. `wrangler
# deploy` does not: it deploys the environment scripts/build.sh already
# flattened, so it takes no --env.
set -eu

branch="${WORKERS_CI_BRANCH:-}"
echo "deploy: branch ${branch:-<unset>}"

case "$branch" in
main)
	pnpm exec wrangler d1 migrations apply self --env production --remote
	pnpm exec wrangler deploy
	;;
dev)
	pnpm exec wrangler d1 migrations apply self-dev --env dev --remote
	pnpm exec wrangler deploy
	;;
*)
	# Every other branch previews against production's schema and migrates
	# nothing. A branch that needs a new column 500s until it merges.
	pnpm exec wrangler versions upload
	;;
esac
