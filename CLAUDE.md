# WHACK 2026: [PROJECT NAME]

> [One sentence: what it does and who it's for]

## Stack
<!-- Fill in at kickoff -->
- Framework:
- UI:
- Database:
- External APIs: [sponsor API + anything else]
- Deploy target:

## Commands
<!-- Fill in once stack is chosen. Agents copy these verbatim. -->
- `[dev command]`: start the dev server
- `[build command]`: production build (slow; Tier 2 only)
- `[typecheck command]`: e.g. `npx tsc --noEmit`, `pyright`
- `[lint command]`
- `[unit test command]`: full unit suite
- `[related test command]`: tests for changed files only, e.g. `npx vitest related --run <files>`, `pytest <path> -x -q`
- `[smoke command]`: hits the demo path once, e.g. `curl -sf -X POST localhost:3000/api/x -d '{}'`

## Demo path
<!-- One line, set by /spec: the flow judges see. The smoke check exercises it. -->
- [screen → action → result]

## Testing (fast tiers)
Speed is the point. Run the cheapest tier that answers the question.

| Tier | When | Runs | Budget |
|---|---|---|---|
| **0** | Every edit loop | typecheck + **related tests only** for the files you touched | < 15s |
| **1** | Once, before reporting a feature done | lint + typecheck + full unit suite | < 60s |
| **2** | Team lead, once per merge onto the session branch | Tier 1 + build + smoke the demo path | < 3 min |

- **Test** pure logic on the demo path, parsing of external API responses, and every bug you fix (failing test first, if it's reachable in seconds).
- **Don't test** UI components, glue, styling, config or one-off scripts. Smoke-check them once by hand instead.
- **No** live API calls, E2E or browser suites, `sleep` or real timers in the default run. Mock at the network boundary. Make one real call by hand before calling a sponsor-API feature done.
- A test slower than 2s gets fixed or moved out of the default run.
- Fix the code, not the tests. Never weaken, skip or delete a test to get green.
- No test framework yet? Use the lightest one native to the stack (Vitest for JS/TS, pytest for Python) and decide once at scaffold time.

## Architecture
<!-- Fill in after initial scaffolding -->
- Entry point:
- API routes:
- Shared contracts (types): [file]. Build against these and change them only by agreement.

| Folder | Owner | What |
|---|---|---|
| | | |

## Mock-first rule
- Every wrapper around an external API returns mock or cached data when its key is missing or the call takes more than 5s. The app must always run end to end.
- Mocks live next to the code that uses them.

## Sponsor API
<!-- Fill in at kickoff -->
- Key in `.env.local` as `[SPONSOR]_API_KEY`. Server-only: never in client code or `NEXT_PUBLIC_*` vars.
- Docs: [link]
- SDK: [install command]. **Check method names and model IDs against the installed SDK types, not the docs.**

## Rules
- Read files before editing. Don't guess what exists.
- No features beyond what was asked. Hackathon scope is tight.
- Match existing patterns. Don't refactor adjacent code.
- Commit after every working feature. Small commits, clear messages, stage by path.
- No abstractions for one-time code. Inline is fine for 24 hours.
- Skip error handling except on the demo path.
- Never `git stash`. Parallel agents share the stash across worktrees.

## Agent team
The `team-lead` agent (`.claude/agents/team-lead.md`) coordinates. It spawns these agents, and you can also call them directly:

| Agent | Model | Use for |
|---|---|---|
| `feature-agent` | Sonnet | Build one feature in a `.sandboxes/` worktree on `feature/*` |
| `debugger` | Sonnet | Unclear or intermittent bugs: failing test + root cause, no app edits |
| `scout` | Sonnet | Sponsor API shapes, SDK methods, library choice (time-boxed, read-only) |
| `bar-raiser` | Opus | Pre-merge review of the diff: demo-breakers, leaks, test tampering |
| `explorer` | Haiku | "Where is X / what touches Y" in seconds |
| `test-runner` | Haiku | Runs a tier and reports only failures |

Skills: `/spec` (kickoff), `/fix` (error → fix), `/verify` (Tier 1/2 + diff scan), `/ship` (solo commit + push), `/secure` (pre-deploy scan), `/demo` (pitch script), `/unstick` (agent is looping).

## Context management
- When context feels long (50+ tool calls), write the plan to `PLAN.md`, then `/compact`.
- Compact after finishing research, a bug, or a feature. Don't compact mid-implementation.
- After compacting, read `PLAN.md` and `SPEC.md` back.

## Team
- Merge to `main` only when the feature works and Tier 2 passes. Merging to `main` needs a human.
- Coordinate before touching shared files (contracts, layout, config).
- Each person owns their branch. Don't edit others' branches.
