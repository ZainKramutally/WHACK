---
name: unstick
description: When Claude is looping, failing repeatedly, or burning tokens without progress. Meta-debugging for agent behavior.
---

# Unstick

Use when you notice Claude is stuck: repeating the same fix, looping on an error, or spinning without progress.

## Step 1: Stop and capture

Do not retry. Instead, write down:
- What was the original goal?
- What was the last tool call sequence? (the last 3-5 tool calls)
- What error or symptom keeps repeating?
- How many times has this been attempted?

## Step 2: Diagnose the pattern

Match against these common failure modes:

| Pattern | Signal | Recovery |
|---------|--------|----------|
| **Loop** | Same edit/error 3+ times | Stop. The approach is wrong, not the execution. |
| **Context overflow** | Responses getting shorter, losing earlier instructions | `/compact` now. Write current plan to a file first. |
| **Wrong hypothesis** | Fix doesn't change the error at all | Re-read the error. The root cause is not where you think. |
| **Stale state** | Code looks right but tests fail | Check you're editing the right file (right sandbox?). Clear caches and rebuild. Never `git stash`, because it's shared with other agents. |
| **Dependency issue** | Import errors, module not found | Check package.json/requirements.txt. Did you forget to install? |
| **API mismatch** | Code matches docs but gets 400/422 | Docs may be stale. Probe the real API with curl first. |
| **Slow loop** | Each attempt waits on a full build or suite | Drop to Tier 0: run only the one failing test or the typecheck. |

## Step 3: Smallest safe recovery

Pick ONE action based on the pattern:

1. **Loop**: `/clear` and restate the goal with what you learned. Do not paste the old conversation.
2. **Context overflow**: Write plan to `PLAN.md`, run `/compact`, then read `PLAN.md` back.
3. **Wrong hypothesis**: Read the ACTUAL error message character by character. Grep the codebase for the error string. Find where it is thrown.
4. **Stale state**: `pwd` and `git branch --show-current` to confirm where you are. Then clear the framework cache (`.next`, `.vite`, `__pycache__`) and retry. Reinstall deps only as a last resort.
5. **Dependency**: Check the real installed version, not what you assume.
6. **API mismatch**: `curl` the endpoint directly with minimal payload. Compare response to what your code expects.
7. **Slow loop**: Run only the single failing test (`vitest run path -t name` / `pytest path::test -x`). Re-add the wider checks once it's green.

## Step 4: One check, then retry

Run exactly ONE verification command to confirm the world state matches your assumption. Only then retry the original task.

Do NOT retry the exact same approach. Change one thing based on what you learned.
