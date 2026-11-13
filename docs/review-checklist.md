# Hoop Shot 3D — Review checklist and known gaps

What the team needs to check by playing, and what is known to be missing or rough. Updated Nov 13, 2026, after work-list rows 1–17 of [next-steps.md](next-steps.md).

The game was only tested in a headless browser (no graphics card, no speakers, scripted key presses). It has never been played by a person at full speed. Everything under "Needs a playtest" needs a person; everything under "Known gaps" is already known and does not need reporting again.

When you check something, write your initials and what you found in the Result column, or open a GitHub issue for anything that needs a change.

## Needs a playtest

| Area | What to check | Work-list row | Result |
| --- | --- | --- | --- |
| Shot feel | Does power feel consistent now? The same hold should always give the same shot | 5 | |
| Shot feel | Is it too easy? Green always goes in and the zone is always shown on Easy and Medium. A scripted player won 158–15 on Easy | 6 | |
| Shot feel | Can you read the green zone while it moves as you aim? | 6 | |
| Shot feel | Do makes and rim-outs look believable? Watch soft shots off the front and back of the rim from the Ball Follow camera | 8 | |
| Shot feel | Starting every game at spot 1 (a corner three, the hardest shot): good or bad? | 9 | |
| Shot feel | Is the half-second camera glide between spots enough of a "move"? | 9 | |
| Scoring | Are scores too high? The money spot stacks with streak bonuses and Money Rack. The cap is row 20 | 10, 20 | |
| Shooter | Does the shooting motion look natural? Hold Space and watch from the Orbit camera | 12 | |
| Shooter | With the camera further back, is aiming harder? Does the body block the view from the corners? | 11 | |
| Shooter | Do the hair styles read from behind (that is the view you see most)? | 13 | |
| Sound | How do the sounds sound? They are crude placeholders made in code, untested by ear. Turn the volume down for the first try | 14 | |
| Crowd | Does the fan meter swing too easily or too slowly? A rival run of 8 makes took it from your side to almost all the rival's | 15 | |
| Crowd | Does the Pro Arena (160 fans) run smoothly on the slowest team laptop? | 16, 25 | |
| Picks | Does the pick feel like a jackpot moment? Is 5 seconds (3.5 after the cards land) enough to read and choose? | 1, 17 | |
| Match | Do too many games go to overtime with "within 10 points"? | 1 | |
| Two players | Is mouse aiming against arrow-key aiming fair? | | |
| Two players | Can your keyboard register both players' keys at once (both charging while Player 2 holds an arrow)? | | |
| Two players | Are the split-screen halves readable (hoop size, both power meters)? | | |
| Campaign | Can the later bosses be beaten? Are chest odds, upgrade costs and gear strength fair? | | |
| Tutorial | Can a first-time player finish it? (It will be rebuilt in row 27) | 27 | |
| Preview link | In the claude.ai preview, does the mouse lock inside the game, and does saved progress (gold, cards, player look, money spot) survive a reload? | | |
| Docs | Each teammate: read your section of [how-it-works.md](how-it-works.md) and say what is unclear | 3 | |

## Known gaps

### Shooting and physics
- **Green is not guaranteed with Moving Hoop or Slippery Ball on you.** The zone assumes a still hoop and a normal rim.
- **Only the widest scoring range is green.** A second, smaller range (a lucky rim-in) can still go in without being green.
- **The opponent's smaller green zone at a full fan meter is mostly visual.** The physics does not change, so a release just outside the shrunk zone can still go in.
- **Balls pass through each other.**
- **Working out a green zone takes about 8 ms.** It is limited to 20 times a second while aiming. Row 24 fixes this properly.

### Shooter and camera
- **No walking between spots.** The figure slides to the next spot with the camera.
- **The shooter's floor shadow is a plain disc.**
- **C changes the camera for both players at once** in two-player.

### HUD and two-player
- **The two-player HUD has no "Spot, shot 3 of 5" line and no money-spot text.** The floor markers and green rings are there.
- **The rival's money spot is marked on its floor but not named in the HUD.**
- **Inferno's red-orange lights and crowd-fire orange flash follow Player 1 only** in two-player; Player 2 still gets the glowing rim and fire.
- **In the Sandbox, moving the mouse down to the panel also moves the crosshair**, so the green zone disappears until you aim at the rim again.

### Effects and looks
- **Blackout leaves the net, spot markers and green rings bright.**
- **Glow and Lava balls do not glow in the dark; the Snowball sheds no flakes.** Ball skins change texture and shine only.
- **Sounds are placeholders.** No recorded sounds, music, announcer lines or crowd chants. Real files go in `sounds/` (see the README).
- **Many Design Bible ideas are not built.** The "What is built" table at the top of [design-bible.md](design-bible.md) lists them.

### Rules and content
- **No mythic cards exist yet.** Overtime cards step down to legendary until Justin designs them.
- **The fan meter is frozen in the tutorial and sandbox.**
- **The tutorial is out of date.** It does not teach the shooter, moving green zone, money spot, fan meter, 5-second pick or skip bonus. Row 27 rebuilds it.
- **AI rival:** it never skips a pick, and does not react to the score yet (row 21).
- **Score multipliers are not capped yet** (row 20). **Streaks can resolve out of shot order** when several balls are in the air (row 22).

### Project
- **No GitHub Pages link yet.** The repo is private; turning Pages on needs GitHub Pro (free with the student pack) or a public repo.
- **The AI Use Log does not name the model** for each session (Claude Code does not write model names into repo files). The commit messages name it.
- **Open question:** which team laptop is the slowest, for the performance targets (rows 24–26)?
