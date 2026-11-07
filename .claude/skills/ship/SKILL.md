---
name: ship
description: Verify, commit and push the current feature branch. Use when a feature is done and you're working solo, not as a team-lead-managed agent.
---

# Ship

For a human-driven session on your own branch. Team-lead-managed agents don't push. They commit and report instead.

Run these in order and stop on any failure:

1. `git branch --show-current`. If you're on `main`, stop and ask. Never push straight to `main` without explicit approval.
2. Run `/verify` (Tier 1). Fix any failures and retry. Don't push broken code.
3. Run `git status` and stage your changed files by path. Never stage `.env*`, secrets or build output.
4. Write a clear one-line commit message describing what changed, then commit.
5. `git push -u origin HEAD`.

Report: `Shipped: {commit message} on {branch}`.
