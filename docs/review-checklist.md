# Hoop Shot 3D — Review checklist and known gaps

What the team needs to check by playing, and what is known to be missing or rough. Updated Nov 13, 2026, after work-list rows 1–27 of [next-steps.md](next-steps.md).

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
| Scoring | Are scores still too high, or is the 12-point cap on one basket about right? | 10, 20 | |
| Shooter | Does the shooting motion look natural? Hold Space and watch from the Orbit camera | 12 | |
| Shooter | With the camera further back, is aiming harder? Does the body block the view from the corners? | 11 | |
| Shooter | Do the hair styles read from behind (that is the view you see most)? | 13 | |
| Sound | How do the sounds sound? They are crude placeholders made in code, untested by ear. Turn the volume down for the first try | 14 | |
| Crowd | Does the fan meter swing too easily or too slowly? A rival run of 8 makes took it from your side to almost all the rival's | 15 | |
| Speed | On the slowest team laptop, open the game with `?stats` at the end of the address and play the Pro Arena, Boardwalk and Frozen Lake. Write down fps and the slowest frame. Targets: 60 fps, no frame over 20 ms | 16, 24, 25 | |
| Speed | Is switching courts instant? (The first time a court is used it may take a moment if you go straight from loading the page into a match) | 26 | |
| Picks | Does the pick feel like a jackpot moment? Is 5 seconds (3.5 after the cards land) enough to read and choose? | 1, 17 | |
| Match | Do too many games go to overtime with "within 10 points"? | 1 | |
| Match | Are games against the AI closer now that it reacts to the score? Does it feel fair, or like rubber-banding? | 21 | |
| Match | Can you follow the race at a glance with the race bar? | 23 | |
| Match | With several balls in the air, a make can now show its +2 a moment after the net moves (it waits for earlier shots). Does that feel odd? | 22 | |
| Two players | Is mouse aiming against arrow-key aiming fair? | | |
| Two players | Can your keyboard register both players' keys at once (both charging while Player 2 holds an arrow)? | | |
| Two players | Are the split-screen halves readable (hoop size, both power meters)? | | |
| Campaign | Can the later bosses be beaten? Are chest odds, upgrade costs and gear strength fair? | | |
| Tutorial | Give it to someone who has never played. Can they finish all 8 steps? Do they understand each feature afterwards (green zone, 5 shots per spot, money spot, fan meter, 5-second pick and skip)? | 27 | |
| Tutorial | In the tutorial race, does Coach's scripting feel natural, or obviously fake (hurrying when you lead, the buzzer-beater if you are more than 10 ahead)? Does overtime with the mythic feel like a reward? | 27 | |
| Screen | Does the game fill your screen, stay sharp, and still aim correctly in fullscreen and at 125% browser zoom? Does the Fullscreen button work (it may be blocked inside the claude.ai preview)? | 18 | |
| Graphics | Do the courts look clearly better (floor shine and reflections, soft shadows, ring spot markers, pole padding, ceiling lights)? Anything that looks wrong? | 19 | |
| Graphics | Do the shiny courts (Home Gym, Pro Arena, Neon Arcade, Rooftop, Frozen Lake) still run at 60 fps on the slowest laptop? The reflection costs about one extra frame-step here in software rendering | 19, 25 | |
| Preview link | In the claude.ai preview, does the mouse lock inside the game, and does saved progress (gold, cards, player look, money spot) survive a reload? | | |
| Docs | Each teammate: read your section of [how-it-works.md](how-it-works.md) and say what is unclear | 3 | |

## Known gaps

### Shooting and physics
- **Green is not guaranteed with Moving Hoop or Slippery Ball on you.** The zone assumes a still hoop and a normal rim.
- **Only the widest scoring range is green.** A second, smaller range (a lucky rim-in) can still go in without being green.
- **The opponent's smaller green zone at a full fan meter is mostly visual.** The physics does not change, so a release just outside the shrunk zone can still go in.
- **Balls pass through each other.**
- **Working out a green zone takes about 2 ms** (35 test shots). At most one is done per frame.

### Shooter and camera
- **No walking between spots.** The figure slides to the next spot with the camera.
- **The shooter's floor shadow is a plain disc.**
- **C changes the camera for both players at once** in two-player.

### Graphics
- **Reflections show only the hoops, balls and players**, not the walls or the crowd (that would double the work). At the edge of an outdoor court a reflection can spill a little onto the ground.
- **The game is never wider than 2560 pixels inside**, to keep slow laptops fast; on a very large screen it is slightly soft.
- **Frame rates were only measured in software rendering** (no graphics card on the test machine), so they compare builds but say nothing about real speed. Use `?stats` on a real laptop.
- **Court images use video memory:** all 7 courts kept painted is about 150 MB. If a laptop runs short, the cache can be limited to the last few courts.
- **The green zone can skip a scoring range only 1–2 power points wide**, and can include a 1-point gap inside the range (a release there is still made to go in).

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
- **No mythic cards exist yet.** Overtime cards step down to legendary until Justin designs them. The **Placeholder Mythic** (marked as a placeholder) is only handed out in the tutorial race; it shows in the sandbox list too.
- **The fan meter is frozen in the tutorial and sandbox.**
- **The tutorial teaches the fan meter by text only**, because the meter is frozen in practice. It moves in the tutorial race.
- **The tutorial race is scripted every time you play campaign stage 1**, not only the first time, so its stars are easy.
- **A player who never scores in the tutorial's overtime still loses** (Coach stops scoring, but cannot hand you points).
- **In the tutorial race the hint box covers the bottom of the court.**
- **AI rival:** it never skips a pick.
- **The score cap is a plain cut-off at 12.** Bonuses past it are lost; the popup shows +12.

### Project
- **No GitHub Pages link yet.** The repo is private; turning Pages on needs GitHub Pro (free with the student pack) or a public repo.
- **The AI Use Log does not name the model** for each session (Claude Code does not write model names into repo files). The commit messages name it.
- **Open question:** which team laptop is the slowest, for the performance targets (rows 24–26)? Check it with `?stats`.
