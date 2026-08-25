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

echo "branch: ${WORKERS_CI_BRANCH:-<unset>}"

case "${WORKERS_CI_BRANCH:-}" in
main)
	npx wrangler d1 migrations apply self --remote
	npx wrangler deploy
	;;
dev)
	npx wrangler d1 migrations apply self-dev --remote --env dev
	npx wrangler deploy --env dev
	;;
*)
	# Every other branch previews against production's schema and migrates
	# nothing. A branch that needs a new column 500s until it merges.
	npx wrangler versions upload
	;;
esac
