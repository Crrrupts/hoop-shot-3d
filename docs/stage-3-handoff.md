# Handoff: Hoop Shot 3D — Stage 3, round 1 (Claude Code)

You are continuing the WebGL basketball game for Justin's CMPSC 457 team. Justin directs and reviews; Isaiah "Zay" Millien, Amit Gurung and Bom Chhetri gave permission for their code to be updated and are credited for brainstorming and design. All code is AI-generated and must be logged as such.

## Sources

- Repo: https://github.com/Crrrupts/hoop-shot-3d (add it with push access, then clone it).
- **The spec for this round: docs/stage-3-plan.md.** The live, latest version is https://claude.ai/artifact/EXD9rF1pFrXHQRwp67WFST ("Hoop Shot 3D — Stage 3 Plan"); if the two differ, the live doc wins.
- Earlier docs still apply where this round doesn't change them: docs/next-steps.md (Stage 2 work list), docs/design-bible.md, docs/how-it-works.md, docs/review-checklist.md.

## Before you start

1. Check the Stage 2 work list in docs/next-steps.md (the live doc holds the Status column). If any row is unfinished, finish it first. The graded requirements must keep working through every change in this round.
2. Run `node tests/physics.test.js` and load the game in a headless browser, so you know the starting state is green.

## What to build this round (in this order)

### 1. New pick odds (powerups.js, game.js)

Replace the `ODDS` table and `oddsRow()` with the tables in the plan's "New pick odds" and "After a skip" sections.

- One row per pick: pick 1, pick 2, pick 3, pick 4 and later. Overtime stays 100% mythic. Mythics aren't designed yet, so keep today's fallback (overtime steps down to legendary until they exist).
- Skip rule changes. A skip no longer moves you one row down. If a player skipped their previous pick, their next pick uses that pick number's "after a skip" row, then the pick after goes back to normal. `pickBoost` becomes a yes/no for "skipped the last pick", not a counter.
- Campaign, Quick Match and 2 Players all use this same table for now (drop the separate `multiplayer` table). Leave the campaign rivals' `maxRarity` caps as they are.
- Use the numbers exactly as written, decimals included. Pick 4's 15% common / 5% rare is intentional; don't "fix" it.
- Add tests: every row adds up to 100, `oddsRow()` returns the right row for picks 1–6, with and without a skip, and in overtime.
- Update the tutorial and hint text that says skipping gives "better odds next pick" only if the wording no longer fits.

### 2. Leaderboards

Follow the plan's "Leaderboards" section.

- Quick Match games only. Two boards per court and difficulty (Easy, Medium, Hard): high score (most points in one game) and combo (most makes in a row in one game). Top 10, each entry with name, score and date. Overtime points count.
- Each campaign stage gets its own separate high-score board (top 10).
- Save in localStorage, wrapped in try/catch, the same way cards.js does. Build the keys from the court list so any new court (Zay is designing new maps) gets boards automatically, with no code change.
- "New high score!" / "New best combo!" after a game. A Leaderboards button on the main menu opens a screen with a court picker and difficulty tabs, plus a campaign tab.
- Name: ask for a short name the first time a score makes a board, then remember it.

### 3. Next features (plan's "More features"; in this order)

1. **Daily challenge:** the date picks the court, difficulty and a seed for the power-up rolls, so everyone gets the same game that day. Has its own daily board (local for now).
2. **Instant replay:** after a buzzer-beater, deep three or game-winner, replay the shot in slow motion from a cinematic camera angle. Skippable with a key or click. It must not pause or eat into the game clock.
3. **Post-game stats:** shot chart (makes and misses by spot), shooting %, best streak, power-ups used.
4. **Challenge codes:** after a game, show a short code that holds the court, difficulty and roll seed. Entering it from the menu plays the same game, and the result screen shows the original score to beat. No server.

### 4. Match modifier (third roll): the system only

Follow the plan's "Third roll: match modifier".

- Quick Match and 2 Players only, never the campaign.
- At game start, secretly choose which of the first four picks it shows up at: pick 1 15%, pick 2 20%, pick 3 50%, pick 4 15%.
- At that pick, a third reel spins beside the buff and sabotage cards. There is no choice. The same modifier applies to both players for the rest of the game, and its name and effect are shown on screen. It does nothing until it shows up. It rolls once per match.
- **Justin hasn't designed the modifiers yet.** Build a list in its own file that's easy to add to, and put in one clearly labelled placeholder only, so the flow can be tested. Do not invent a set of modifiers.

## Not this round

- New power-up cards and mythics: Justin designs them; Claude reviews them before they're built.
- Weekly modifiers, the reward system and online 2-player: later rounds.
- New courts: Zay designs them. Just make sure leaderboards pick them up automatically.

## Rules for every chunk

1. Small chunks. Each one ends with a commit and a push. Confirm the push landed (`git ls-remote` matches your local commit).
2. Before pushing: run `node tests/physics.test.js` (add tests for new rules), load the game in a headless browser and check the console for errors, and play one full Quick Match and one campaign stage to the end.
3. Never break a graded requirement. If one breaks, fix it before anything else.
4. The team does the real playtesting. You only check for bugs, crashes and broken flows.
5. Keep the code readable for students: plain JS, short comments, no new libraries.
6. Add an entry to GA1_AI_Use_Log.md for each session: the code was AI-generated (model name), what was built and how it was checked.
7. End each chunk with a short note to Justin: what changed, what to test, known bugs, and any choice you made that the plan didn't cover.
