#!/bin/sh
# Workers Builds deploy command. See docs/adr/0006-migrations-run-in-the-deploy-command.md.
#
# Migrations ride this step because it is the step Cloudflare authenticates
# for wrangler. The script fails closed: a failed migration exits non-zero
# and the Worker never uploads.
#
# --remote is mandatory. Without it the migration writes a local file and
# exits 0, so the miss is silent.
set -eu

branch="${WORKERS_CI_BRANCH:-}"
echo "branch: ${branch:-<unset>}"

# Skip the migration step while no schema exists. wrangler's behaviour on an
# empty migrations folder is not worth depending on. Remove this once the
# first migration lands (#51) — by then the folder always has a file.
has_migrations() {
	ls migrations/*.sql >/dev/null 2>&1
}

case "$branch" in
main)
	if has_migrations; then npx wrangler d1 migrations apply self --remote; fi
	npx wrangler deploy
	;;
dev)
	if has_migrations; then npx wrangler d1 migrations apply self-dev --remote --env dev; fi
	npx wrangler deploy --env dev
	;;
*)
	# Every other branch previews against production's schema and migrates
	# nothing. A branch that needs a new column 500s until it merges.
	npx wrangler versions upload
	;;
esac
