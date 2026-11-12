# Hoop Shot 3D — Next Steps for Production

Snapshot of Nov 12, 2026 (updated after Justin's playtest). The live, latest version is https://claude.ai/artifact/LPNUvA2H9FFRGdACNJjJ4D; if the two differ, the live doc wins (and it holds the Status column).

This is the next handoff for Claude Code (Fable 5.2). The base game on `main` works; this round makes it feel good, run smoothly and stay safe for grading, in that order. Read the Design Bible (docs/design-bible.md) for the full spec; where the two disagree, this doc wins.

## Decisions

Games are now **2 minutes**, with a 1-minute overtime when the scores are within 10 points. The table lists every rule change from Justin's latest playtest; numbers are starting values to tune.

| Setting | Was | Now |
| --- | --- | --- |
| Game length | 3 minutes | 2 minutes (`SETTINGS.gameLength = 120`) |
| Overtime | Only on a tie | 1 minute whenever the scores are within 10 points when the clock ends |
| Power-up pick gap | Every 30–45 s | Every 20–30 s |
| Early first pick | At your 2nd make, before 30 s | At your 2nd make, before 20 s |
| Time to pick | 8 s, game paused | 5 s at most, game paused |
| Skipping a pick | A random card is picked for you | No card, but your next pick's odds move one step toward rarer cards |
| Mythic cards | In the last 2 minutes | Overtime only (none are designed yet, so overtime steps down to legendary until they exist) |
| Green power zone | Easy mode or the Sweet Spot card | Always on and moves with your aim; off on Hard and while the new Blind Meter sabotage is on you |
| Shooting spots | Move freely with A/D | 5 shots at a spot, then the game moves you to the next spot |
| Crowd | Always cheers for you | Starts on the home team's side and can switch to the other player if they play great |
| Crowd size | Similar on every court | Matches the court: a handful at the YMCA, a packed house at the Pro Arena |
| Shooter | A floating ball | A visible 3D player whose shooting motion follows the power bar |
| Screen size | Fixed 800×600 | Fills the window |

Also decided: AI-written code is allowed by the teacher. Keep the AI Use Log accurate and keep the team's credits in the README.

**Power-ups:** Justin will design a batch of new power-ups and review them with Claude first. Until then, don't add power-ups beyond Blind Meter.

## Work list

Work top to bottom: priority 1 must be finished before priority 2 starts, and so on. Each row says when it counts as done. Numbers are starting values for the team to tune in playtesting. Track Status in the live doc.

| # | Priority | Change | Done when |
| --- | --- | --- | --- |
| 1 | 1 Grade safety | Apply every row of the Decisions table that is a rule change: 2-minute games, overtime within 10 points, 20–30 s picks, 5 s pick limit, skip bonus, mythics in overtime only | Each rule has a test in `tests/`, and a full game plays by the new rules |
| 2 | 1 Grade safety | Check all 9 graded requirements still work after every change in this list | A one-page checklist in the README: each requirement, where it is in the code, how to see it in the game |
| 3 | 1 Grade safety | Write a short "How it works" note per area (rendering, physics, input, UI) so each teammate can explain their part | docs/how-it-works.md, plain language, one section per area |
| 4 | 1 Grade safety | Bring the README and Design Bible in line with the code (e.g. Shoes gear does not exist, Sleeve works differently) | Nothing in the docs promises a feature the game lacks |
| 5 | 2 Shot feel | Fix power that feels inconsistent: work out power from how long Space was held (real time), not frame by frame, and remove the random save in the grey zone | Holding Space for the same time always gives the same power and the same kind of result |
| 6 | 2 Shot feel | Green power zone always on, worked out for where you are aiming right now, so it moves and resizes as you aim. Off on Hard and while Blind Meter is on you | Moving the crosshair visibly moves the zone; a release in green goes in nearly every time |
| 7 | 2 Shot feel | New sabotage card, Blind Meter (rare): hides the opponent's green zone for 3 shots | Shows up in picks and in the sandbox |
| 8 | 2 Shot feel | Tune how the ball goes in and out: rim and backboard bounces, rolls around the rim, so close shots look fair | The team agrees makes and rim-outs look believable in a playtest |
| 9 | 2 Shot feel | 5 shots per spot, then the game moves you to the next spot with a short camera move. HUD shows "Shot 3 of 5" | Spot changes on its own after the 5th shot |
| 10 | 2 Shot feel | Make the crosshair jump after each shot smaller, or an option that is off by default | Aiming the next shot takes under a second |
| 11 | 3 Shooter | A 3D shooter built from our own shapes in a matrix-stack hierarchy (torso → arms → hands, head, legs). This also strengthens the graded hierarchical modeling | The player stands at the spot and holds the ball |
| 12 | 3 Shooter | Shooting animation tied to the power bar: knees bend and the ball rises as the bar fills, release exactly when Space is let go, then follow-through | The motion matches the bar at every point, at any meter speed |
| 13 | 3 Shooter | Customize the shooter: skin tone and hair style. Pants and shoes stay fixed for now (future upgrade cards) | A picker in the menu; the choice is saved |
| 14 | 4 Crowd and audio | Audio now: placeholder sounds made in code (Web Audio, no files) for every sound the game asks for, including rim, board, swish, floor bounce, cheer, groan, boo, stomp, buzzer and the streak chime. Team files replace them later by dropping them into sounds/ | Every event in a game makes a sound; a file in sounds/ with the same name replaces it |
| 15 | 4 Crowd and audio | Fan meter: a bar showing which player the crowd backs. It starts on the home team's side; strong play by the other player (streaks, swishes, a run of points) pulls it over. When it crosses the middle the crowd switches: it cheers them and boos you | The crowd can switch sides during a game, and you can see and hear it |
| 16 | 4 Crowd and audio | Crowd size by court: about 5 at the YMCA, 30 at Home Gym, 40 at Neon Arcade, 150 or more at the Pro Arena (drawn in batches so it stays fast), a few standing at the outdoor courts | Each court's crowd looks right for the place |
| 17 | 5 Casino pick | Make the power-up pick feel like a slot machine: the cards spin like reels and slow down one at a time, tease a higher rarity before landing, tick and glow in the rarity's color, and give rare-or-better cards a flash and fanfare. All within the 5 s limit | The pick feels like a jackpot moment in a playtest |
| 18 | 6 Screen and graphics | Fill the window: canvas and HUD scale together to the window size, keeping the shape, plus a fullscreen button | Fills a 1080p screen; still works with browser zoom at 125% |
| 19 | 6 Screen and graphics | Graphics pass: shinier floors, softer shadows, more detail on the ball and hoop, better arena and sky, lighting tuned per court | Clearly better-looking courts, still 60 fps |
| 20 | 7 Match flow | Cap stacking score multipliers (Inferno, Money Rack, Golden Ball, Moneyball) | No single basket is worth more than about 12 points |
| 21 | 7 Match flow | Rival reacts to the score: shoots a little better when behind, a little worse when far ahead | Close games happen more often in playtests |
| 22 | 7 Match flow | Streaks resolve in shot order when several balls are in the air | A later make never counts before an earlier miss |
| 23 | 7 Match flow | A race bar at the top showing both scores, or a bigger rival view | You can follow the race at a glance |
| 24 | 8 Performance | Stop re-running about 100 shot simulations when the wind shifts or the aim moves (the moving green zone makes this matter more) | No frame over 20 ms on Boardwalk and Frozen Lake |
| 25 | 8 Performance | Cut per-frame matrix work (batched crowd, fewer normal-matrix inverses) | Pro Arena with its full crowd holds 60 fps on the slowest team laptop |
| 26 | 8 Performance | Paint court textures once per court and keep them | Switching courts takes under half a second |
| 27 | 9 Tutorial | Update the tutorial for everything above: the shooter and power bar, the moving green zone, 5 shots per spot, the fan meter, the 5 s pick and the skip bonus | A new player can finish it and understands each feature |

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

- [ ] Shirt or jersey: customizable now, or fixed like pants and shoes (a future upgrade)?
- [ ] After 5 shots the game moves you on: in a fixed order (spot 1 to 5), or can players still pick their next spot with A/D?
- [ ] Does the fan meter change gameplay (for example, a small boost for whoever the crowd backs), or only the sound and visuals?
- [ ] Is the crosshair jump after each shot worth keeping as an option, or removed?
- [ ] Which laptop is the slowest on the team, for the performance targets?
- [ ] Does campaign stage 1 (the tutorial race) stay at 60 seconds, or drop to match the shorter games?
