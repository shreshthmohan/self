## Agent skills

### Issue tracker

Issues live as GitHub issues; use the `gh` CLI. See `docs/agents/issue-tracker.md`.

### Triage labels

The five canonical labels, unchanged: `needs-triage`, `needs-info`, `ready-for-agent`, `ready-for-human`, `wontfix`. See `docs/agents/triage-labels.md`.

### Domain docs

Single-context: `CONTEXT.md` and `docs/adr/` at the repo root. See `docs/agents/domain.md`.

## Branching and Git Worktrees

This repo uses a bare repo + worktrees setup (.bare + sibling folders per branch).

- When asked to create a new branch, also create a matching worktree
  (`git worktree add ../<branch-name> -b <branch-name>`) instead of just `git branch`/`git checkout -b`.
- When given a task that isn't scoped to an existing branch/worktree, default to creating a
  new branch + worktree for it (based off `dev`) rather than working directly in the current one.
