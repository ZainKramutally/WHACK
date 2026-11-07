---
name: fix
description: Paste an error message or describe a bug. Traces the cause, adds a fast repro test when the logic is unit-reachable, and fixes it. Max 3 cycles.
---

# Fix

Fast bug squashing. Paste an error, a stack trace, or a description of what's wrong.

## Process

1. Parse the error. Take the **first** error, not the last, and find the file and line in the stack trace.
2. Read that file and its imports. Common hackathon bugs:
   - Missing import or wrong path
   - Undefined variable or a typo in a name
   - Wrong API response shape (compare the real response with what the code expects)
   - Missing env variable (check `.env.example`)
   - Type mismatch between frontend and backend
   - Missing `await`
   - CORS or network error
3. If the bug is in logic a test can reach in seconds, add **one** test that reproduces it and run just that test (Tier 0). It must fail. Skip this step for config, env, styling or dependency issues.
4. Fix the root cause with the fewest lines possible. Fix the code, not the test. If the test itself looks wrong, stop and say so.
5. Re-run Tier 0 (typecheck plus related tests). The new test must pass.
6. Report what was wrong, what you changed, and the test that guards it (or why there's none).
7. If a new error appears, go back to step 1. Max 3 cycles. If it's still failing, stop, report what you tried, and suggest `/unstick`, or ask the team lead for a debugger.

If the problem is in a dependency or the environment rather than our code, say so and suggest the manual fix.

Don't refactor surrounding code, don't add error handling beyond what the bug needs, and don't touch unrelated files. Don't use `git stash`.
