# Track Brief: "New Worlds"

The source of truth for what we're building towards and how we judge ourselves. Every idea, feature and demo rehearsal gets scored against this. `/judge` runs the scoring for you.

## The official challenge (verbatim from the track slides)

> **Challenge.** Make a project that explores the idea of **New Worlds**.
> *Build something that opens a door to the unexplored, whether that's new data, ideas or something novel no one has seen before.*
> Interpret the theme however you think best captures the spirit of this idea!
> Please come and chat to us if you're looking for inspiration!

> **We'd like to see:** **Creativity** (highlighted on the slide) · Technical complexity · Good presentation
> **Do what you're interested in!**

Everything below is our interpretation of those two slides. Where we add something the slides don't say (weights, the hook rule, the fps bar), it's labelled **[ours]**.

## The brief in one line

**Open a door to something unexplored (new data, a new idea, or something no one has seen), and make the judge step through it in the first 15 seconds.**

## How we read the theme

The slide names three kinds of door: **new data, ideas, or something novel no one has seen before**. A literal 3D place is one valid answer, but not the only one. What the judge must feel is *"I've never been here before"*. Doors worth exploring, mapped to the slide's wording:

| Reading | Slide wording it answers | What it looks like | Watch out for |
|---|---|---|---|
| **New data as a world** | "new data" | A dataset nobody has walked through, turned into a place you can explore: your city's sounds, a river's history, your own screen-time | The data has to change the world visibly, not just label it |
| **A new idea made explorable** | "ideas" | A concept you can stand inside: a thought experiment, an alternate rule of physics, "what if gravity followed sound?" | It needs one interaction that proves the idea |
| **Something novel** | "something novel no one has seen before" | A form, interface or experience with no obvious precedent | "Novel" is judged against the room. Run the seen-it-before check. |
| **A literal world** | "New Worlds" | A walkable, driveable or flyable 3D place with its own physics, weather and creatures | "Pretty scene, nothing to do." It needs a verb. |
| **A world inside something small** | "unexplored" | A world in a snowglobe, a drop of water, a pocket, a phone's memory | The scale shift has to be shown, not told |
| **A world made from the user** | "new data" (theirs) | The world is generated from your voice, photo, music or name: *your* new world | The generation must be visibly yours, not random noise |
| **A familiar world, made new** | "opens a door" | Your commute, your bedroom or your city re-imagined under different rules | Relatability is free here. Don't waste it on a slow intro. |
| **A world for someone else** | "ideas" | Seeing the world as a bee, a colour-blind person or a 1700s sailor would | Must stay playful. Empathy without fun loses the room. |

A strong concept usually combines two of these. For example, *new data* rendered as *a familiar world, made new*.

**"Do what you're interested in!"** The slide says it outright, and it also helps us: a team that obviously cares about its subject presents better. Every idea must name which teammate is genuinely into it (see the gut checks).

## Rubric (what the judges score)

The slide lists three criteria, **with no weights**. Creativity is the only one highlighted. Weights are **[ours]**: Creativity counts most because of that highlight and the organisers' guidance that creativity outweighs technical complexity. The criterion names below are the slide's own wording, in the slide's order.

| Criterion (slide wording) | Weight **[ours]** | The judge is asking |
|---|---|---|
| **Creativity** (includes theme fit) | **45%** | Does this open a door to something unexplored? Have I seen it before? Do I remember it an hour later? |
| **Technical complexity** | **25%** | Is there real engineering here, or a template? Does the hard part *show*? |
| **Good presentation** | **30%** | Did the first 15 seconds grab me? Did I feel something personal? Was the story clear? |

### Scoring scale (1–5 per criterion)

**Creativity (×9)**
| Score | Anchor |
|---|---|
| 5 | Opens a door to something **no one in the room has seen**: new data nobody has explored this way, an idea made tangible, or a novel form. One sentence makes people lean in. The user *discovers* something (a rule, a pattern, a place) rather than being told it. |
| 4 | Fresh angle on a known idea, with at least one moment of genuine surprise. |
| 3 | Competent and clearly about New Worlds, but a judge could name three similar projects. |
| 2 | "New Worlds" is a label stuck on an unrelated app. Nothing unexplored is revealed. |
| 1 | Generic, with no premise. ("A 3D scene", "a dashboard".) |

**Good presentation (×6)**
| Score | Anchor |
|---|---|
| 5 | Opens on a hook in ≤15s: a question, a personal story or a live moment the judge is *in* (their name, their city, their voice). The demo is a story with a turn. Runs in under 3 minutes with zero dead air. |
| 4 | Clear hook and a clean demo, with one slow or confusing stretch. |
| 3 | Explains the idea well but opens with "So we built…". No personal pull. |
| 2 | Feature tour. The judge has to work to understand why it matters. |
| 1 | The demo breaks or the story is missing. |

**Technical complexity (×5)**
| Score | Anchor |
|---|---|
| 5 | At least one hard thing done well and *visible*: custom shaders, physics, procedural generation, real-time AI driving the world, multiplayer. It runs smoothly (≥50 fps on the demo laptop). |
| 4 | One hard thing, mostly polished, with occasional jank. |
| 3 | Solid use of libraries (three.js, physics, an API) without anything bespoke. |
| 2 | Mostly template or tutorial code. |
| 1 | Static or broken. |

**Total = Creativity×9 + Technical×5 + Presentation×6** (max 100). The multipliers are **[ours]**, matching the weights above.

| Total | Verdict |
|---|---|
| ≥ 80 | Podium contender. Protect it: freeze features, rehearse. |
| 65–79 | Competitive. Find the one weakest criterion and fix only that. |
| 50–64 | Mid-pack. The premise or the hook is the problem, not the code. |
| < 50 | Re-think. Don't polish this. |

## The hook (non-negotiable) **[ours]**

This is our reading of "Good presentation". The slide doesn't spell it out, but judges see many demos in a row. The first 15 seconds decide whether they're watching or waiting. Every pitch must open with **one** of:

1. **Personal relatability.** Put the judge in the world: their name, city, face, voice or a question about their own life. ("Think of the room you grew up in. We're going to rebuild it, and then break its laws.")
2. **A creative cold open.** Start *inside* the world, already moving, no slides. Speak only after the "whoa".
3. **A provocative question or fact** that the world then answers.

Banned openers: "Hi, we're team…", "Our project is…", a title slide, an architecture diagram.

## How we evaluate our tests

We test three things at three stages. Each test has a pass bar. Below the bar we change something before moving on.

### Test 1: Idea test (H0–H1, before writing code)

For each candidate idea in `research/ideas/`:
1. Write the **one-sentence premise** and the **15-second hook** script.
2. Two teammates who didn't pitch it score it on the rubric, independently and silently. Then compare.
3. Answer the **gut checks** below with yes or no.

| Gut check | Must be |
|---|---|
| Does it open a door to **new data, an idea, or something novel**? Name which. | yes |
| Can the premise be told in one sentence without the word "app"? | yes |
| Is there a verb? (The user *does* something in the world.) | yes |
| Is there one "wow" moment we can point to on the timeline? | yes |
| Can we build a working version of that moment by H8? | yes |
| Would a judge with no tech background get it in 15s? | yes |
| Is at least one teammate genuinely into this subject? ("Do what you're interested in!") | yes |

**Pass bar:** projected total ≥ 70 **and** all gut checks are yes. Pick the highest scorer. Ties go to the higher Creativity score.

**Then take the top 1–2 ideas to the challenge setters.** The slide invites it ("come and chat to us"), and their reaction is the closest thing to a real judge's score we'll get before the demo. Spend 5 minutes, ask "Have you seen anything like this today?", and log their reaction in the Score log.

### Test 2: Build checkpoints (H8, H14, H18)

At each checkpoint, run the demo path end to end on the demo laptop and record:

| Check | Pass bar |
|---|---|
| Demo path runs start to finish without a reload | 3 runs in a row |
| Frame rate during the heaviest moment **[ours]** | ≥ 50 fps (Chrome DevTools FPS meter or `stats.js`) |
| Time from page load to first interaction | ≤ 5s on venue Wi-Fi, with cached or mock fallback if offline |
| The "wow" moment lands | A fresh-eyes tester reacts without being prompted |
| Re-score on the rubric | ≥ previous checkpoint. If not, cut scope. |

**H18 is feature freeze.** After it, only demo-path fixes and presentation work.

### Test 3: Demo rehearsal (H19 onwards, at least 3 runs)

Give the full pitch to someone **outside the team** (another team, a mentor, a friend on a call). They score it on the rubric *cold*, with no explanation first. Then ask them only:
1. "Describe what we built in one sentence." (Does it match our premise?)
2. "What moment do you remember?" (Is it our planned wow?)
3. "When did you stop paying attention?" (Cut that part.)

| Measure | Pass bar |
|---|---|
| Outsider's one-sentence summary matches our premise | yes |
| Remembered moment = our planned wow | yes |
| Pitch length | ≤ 3:00, timed |
| Hook lands in ≤ 15s | yes |
| Outsider's rubric total | ≥ 75 |
| Backup recording of the demo exists | yes, saved locally and on a phone |

**A rehearsal fails** if any bar is missed. Fix the single worst item and rehearse again. Never fix more than two things between runs, or you won't know what worked.

## Score log

Append after every test. This is how we know if we're improving.

| Time | Test | Who scored | Creat. | Tech | Pres. | Total | Biggest gap | Action |
|---|---|---|---|---|---|---|---|---|
| | | | | | | | | |
