# Hoop Shot 3D — Next Steps for Production

Snapshot of Nov 12, 2026. The live, latest version is https://claude.ai/artifact/LPNUvA2H9FFRGdACNJjJ4D; if the two differ, the live doc wins (and it holds the Status column).

This is the next handoff for Claude Code (Fable 5.2). The base game on `main` works; this round makes it feel good, run smoothly and stay safe for grading, in that order. Read the Design Bible (docs/design-bible.md) for the full spec; where the two disagree, this doc wins.

## Decisions

Games are now **2 minutes**, with a 1-minute overtime on a tie. The other numbers below follow from that and are starting values to tune.

| Setting | Was | Now |
| --- | --- | --- |
| Game length | 3 minutes | 2 minutes (`SETTINGS.gameLength = 120`) |
| Power-up pick gap | Every 30–45 s | Every 20–30 s, so a game still gets about 4 picks |
| Early first pick | At your 2nd make, before 30 s | At your 2nd make, before 20 s |
| Mythic window | Last 2 minutes | Last 45 seconds (rename the `last2min` odds row) |
| Overtime | Both cards mythic | Unchanged |
| Campaign tutorial race | 60 s | Unchanged |

Also decided: AI-written code is allowed by the teacher. Keep the AI Use Log accurate and keep the team's credits in the README.

## Work list

Work top to bottom: priority 1 must be finished before priority 2 starts, and so on. Each row says when it counts as done. Numbers are starting values for the team to tune in playtesting.

| # | Priority | Change | Done when |
| --- | --- | --- | --- |
| 1 | 1 Grade safety | Switch to 2-minute games and the new pick timings and mythic window (Decisions above) | A full game runs 2:00 plus overtime on a tie; tests updated and passing |
| 2 | 1 Grade safety | Check all 9 graded requirements still work after every change in this list | A one-page checklist in the README, each requirement with where it is in the code and how to see it in the game |
| 3 | 1 Grade safety | Write a short "How it works" note per area (rendering, physics, input, UI) so each teammate can explain their part | docs/how-it-works.md, plain language, one section per area |
| 4 | 1 Grade safety | Bring the README and Design Bible in line with the code (e.g. Shoes gear does not exist, Sleeve works differently) | Nothing in the docs promises a feature the game lacks |
| 5 | 2 Shot feel | Make makes feel earned: wider green power zone or a slower meter on Medium | On Medium the green zone is about 10% of the meter and stays open at least 120 ms |
| 6 | 2 Shot feel | Remove the random save in the grey zone; grey becomes a rim-out or a near miss instead of a coin flip | The same release always gives the same kind of result |
| 7 | 2 Shot feel | Make the crosshair jump after each shot smaller, or an option that is off by default | Aiming the next shot takes under a second |
| 8 | 2 Shot feel | Add a simple shooter model (arms and hands holding the ball) instead of a floating ball | The ball is held and released by a visible player |
| 9 | 3 Match flow | Shorter power-up picks: 3–4 s to choose, and the clock keeps running or pauses only briefly | A pick interrupts play for under 4 s |
| 10 | 3 Match flow | Cap stacking score multipliers (Inferno, Money Rack, Golden Ball, Moneyball) | No single basket is worth more than about 12 points |
| 11 | 3 Match flow | Rival reacts to the score: shoots a little better when behind, a little worse when far ahead | Close games happen more often in playtests |
| 12 | 3 Match flow | Streaks resolve in shot order when several balls are in the air | A later make never counts before an earlier miss |
| 13 | 3 Match flow | Bigger rival view, or a race bar showing both scores at the top | You can follow the race without squinting |
| 14 | 4 Performance | Stop re-running ~100 shot simulations when the wind shifts (cache by spot and coarse wind) | No frame over 20 ms on Boardwalk and Frozen Lake |
| 15 | 4 Performance | Cut per-frame matrix work (one draw for the crowd, fewer normal-matrix inverses) | Pro Arena holds 60 fps on the slowest team laptop |
| 16 | 4 Performance | Paint court textures once per court and keep them; smaller sizes where it does not show | Switching courts takes under half a second |
| 17 | 5 Polish | Scale the canvas and HUD together so the game fits any window size | Works at 1280×720 and with browser zoom at 125% |
| 18 | 5 Polish | Sound hooks ready for the team's audio files: one folder, one list of names | Dropping a file named in the list into sounds/ makes it play |

## How to work

Small chunks, each one checked, pushed and shown to Justin before the next starts. The team does the real playtesting; you check for bugs.

1. Work on a branch named `fable-build`, starting from the latest `main`.
2. Finish one or two rows of the work list, then stop and check.
3. Before pushing: run every test in `tests/` (add tests for new rules), load the game in a headless browser with no console errors, and play one full game to the end.
4. Never break a graded requirement. If one breaks, fix it before anything else.
5. Push, then confirm the push landed (`git ls-remote` matches your local commit) and that it merges cleanly into `main`. Merge into `main` once the chunk passes.
6. Show the build: republish the private preview artifact (slug `7470dc5b-cef7-45d9-a07b-0a3dd2d6e895`, "Hoop Shot 3D") with the changed files, and open it for Justin in the side panel.
7. Mark the row's Status in the live doc and post a short note: what changed, what to test, known bugs, and any choices you made.
8. Add an entry to the AI Use Log for the session, naming the model and what was checked.

Keep the code readable for students: plain JS, short comments that explain what each part does, no new libraries.

## Open questions

If one of these comes up, pick the simplest option, keep it easy to change, and list it in your note.

- [ ] Should power-up picks pause the clock at all, or let play continue while you choose?
- [ ] Is the crosshair jump after each shot worth keeping as an option, or removed?
- [ ] What should the shooter model look like: just arms and hands, or a full simple figure?
- [ ] Which laptop is the slowest on the team, for the performance targets?
- [ ] Does campaign stage 1 (the tutorial race) stay at 60 seconds, or drop to match the shorter games?
