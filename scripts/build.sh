#!/bin/sh
# Workers Builds build command.
#
# The React Router build flattens ONE wrangler environment into
# `build/server/wrangler.json`. The environment is chosen HERE, by
# CLOUDFLARE_ENV — not by `--env` on the deploy, which reads a config that no
# longer has environments. See wrangler.jsonc and
# docs/adr/0006-migrations-run-in-the-deploy-command.md.
set -eu

branch="${WORKERS_CI_BRANCH:-}"

case "$branch" in
dev) env=dev ;;
# Every other branch, `main` included, builds against production. A preview
# branch previews against production's schema on purpose; only the deploy
# step differs, and scripts/deploy.sh makes that call.
*) env=production ;;
esac

echo "build: branch ${branch:-<unset>} -> CLOUDFLARE_ENV=$env"
CLOUDFLARE_ENV="$env" pnpm run build
