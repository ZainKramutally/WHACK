---
name: verify
description: Pre-merge check. Runs Tier 1 (or Tier 2 on the session branch) from CLAUDE.md, then a diff scan for debug code, secrets and test tampering. Reports PASS/FAIL.
---

# Verify

Run this before reporting a feature done (Tier 1) or after a merge onto the session branch (Tier 2). The tiers and their commands are in `CLAUDE.md` → Testing.

## Process

1. Pick the tier: **Tier 2** on a `session/*` or `main` branch, otherwise **Tier 1**.
2. Run the tier's checks in the order CLAUDE.md lists them (cheapest first). Redirect long output to a temp file and read only the failures. **Stop at the first failure**, fix it, and re-run only that check before moving on.
3. **Diff scan.** Run `git diff --stat` against the base, then read the changed files and check for:
   - changes unrelated to the feature
   - debug leftovers (`console.log`, `print(`, `debugger`, `TODO REMOVE`)
   - hardcoded secrets, or localhost URLs that should be env vars
   - tests that were weakened, skipped (`.skip`, `xit`, `@pytest.mark.skip`) or deleted
   - slow tests entering the default run (real network calls, `sleep`, real timers)
4. Report:

```
VERIFY (Tier {n})
  Typecheck: PASS/FAIL/SKIP
  Lint:      PASS/FAIL/SKIP
  Unit:      PASS/FAIL/SKIP  ({count} tests, {seconds}s)
  Build:     PASS/FAIL/SKIP  (Tier 2 only)
  Smoke:     PASS/FAIL/SKIP  (Tier 2 only)
  Diff:      CLEAN / [issues]

  Ready to merge: YES/NO
```

`SKIP` is only allowed when CLAUDE.md marks a check as not configured. Never skip a failing check.
