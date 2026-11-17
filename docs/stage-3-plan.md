# Hoop Shot 3D — Stage 3 Plan

Nov 13, 2026 (updated Nov 15) · Justin Leddo

Live version: https://claude.ai/artifact/EXD9rF1pFrXHQRwp67WFST ("Hoop Shot 3D — Stage 3 Plan"). If this file and the live doc differ, the live doc wins.

Stage 3 comes after the graded game is solid: first a creative power-up revamp, then the reward system, then online 2-player across two computers. Stage 2 (the next-steps work list) finishes first.

## Power-up revamp

Justin designs the new power-ups; this section gives him rules to design against, a template for each card, and creative directions to spark ideas. Today's 20 cards plus Blind Meter stay until the new set replaces them.

**Design rules for every card:**

1. Readable in one second on a spinning card: a short name and one line of effect.
2. You can see and hear it working on screen, not just in the score.
3. Matters inside a 2-minute game.
4. Sabotages have a way to play around them.
5. Skill still decides most games; no card wins on its own except mythics in overtime.

**Card template** (fill one row per idea):

| Name | Side | Rarity | Effect | How long | What you see and hear | How to play around it |
| --- | --- | --- | --- | --- | --- | --- |
| Example: Curveball | Buff | Epic | Steer your ball left or right with the mouse while it flies | Next 3 shots | Spin trail on the ball, a whistle as it bends | None needed (buff) |

**Creative directions.** One example each, to start from or throw out:

| Family | The idea | Example |
| --- | --- | --- |
| Ball changers | The ball itself behaves differently | Curveball: steer the ball in flight |
| Court changers | The court or hoop changes | Trampoline Floor: bounce shots count if they go in off the floor |
| Rule benders | Scoring rules change for a while | Heat Check: each make in a row is worth 1 more than the last |
| Gambles | Casino-style risk and reward | Double or Nothing: next make doubles your score this pick, a miss costs 5 points |
| Crowd cards | Work through the fan meter | Hype Man: the fan meter jumps halfway toward you |
| Mind games | Mess with what the opponent sees or controls | Mirror Hands: opponent's aim left and right are swapped for 3 shots |
| Combos | Get stronger with other cards you hold | Fire Starter: if you already hold 2 fire cards, you start On Fire |
| Mythics | Overtime only, game-deciding | Left to Justin (placeholder for now) |

**New pick odds** (decided Nov 15; replaces the odds table in powerups.js). Players were getting common almost every pick, so the odds now climb fast:

| Pick | Common | Rare | Epic | Legendary | Mythic |
| --- | --- | --- | --- | --- | --- |
| Pick 1 | 50% | 40% | 7% | 3% | 0% |
| Pick 2 | 35% | 50% | 10% | 5% | 0% |
| Pick 3 | 15% | 25% | 50% | 10% | 0% |
| Pick 4 and later | 15% | 5% | 30% | 50% | 0% |
| Overtime | 0% | 0% | 0% | 0% | 100% |

**After a skip** (used instead of the normal row when you skipped your previous pick). The rule: take that pick's normal row and cut common and rare down to 30% of their normal value (half off, then another 20% of the original off). Of the freed-up percent, 80% goes to epic and 20% to legendary, but epic stops at 50%; anything past that goes to legendary too:

| Pick | Common | Rare | Epic | Legendary | Mythic |
| --- | --- | --- | --- | --- | --- |
| Pick 2 after a skip | 10.5% | 15% | 50% | 24.5% | 0% |
| Pick 3 after a skip | 4.5% | 7.5% | 50% | 38% | 0% |
| Pick 4+ after a skip | 4.5% | 1.5% | 41.2% | 52.8% | 0% |

- Each pick now gets its own row (today picks 2 and 3 share one).
- If you skip a pick (let the timer run out), your next pick uses its row from the "After a skip" table instead of the normal one. Pick 1 has no skip row because nothing comes before it. The pick after that goes back to normal odds. This replaces the old rule where a skip moved you one row down.
- Campaign and multiplayer use these same odds (for now).
- Pick 4's 15% common / 5% rare is on purpose (Justin, Nov 15): a common late in the game should be a real risk. Don't "fix" it.

**New power-ups:** a new batch is needed. Justin designs them in the card template above; Claude reviews them before they're built.

## Leaderboards

Each map gets its own leaderboard, split by difficulty (Easy, Medium, Hard), so a Hard score is never ranked against an Easy one.

| Board | What it ranks | Kept per |
| --- | --- | --- |
| High score | Most points in one game | Map + difficulty |
| Combo | Most makes in a row in one game | Map + difficulty |

- Shown after every game ("New high score!" / "New best combo!") and on a Leaderboards screen in the menu, with a map picker and difficulty tabs.
- Top 10 per board, each entry with name, score and date.
- First version saves on this computer only (browser storage). A shared online board can come later with the online 2-player work.
- Only Quick Play games go on these leaderboards. Each campaign map gets its own separate high-score board instead. Overtime points count toward high score.

**New maps** will be designed by Zay (Isaiah Millien). Each new map gets its own leaderboards automatically.

## Reward system

Players earn three things: gold, cards from chests, and player levels. Gold and duplicate cards level up balls and gear; levels unlock cosmetics. There is no real money anywhere in the game. The game already has chests, cards and gold in a basic form; this round makes it the reason to keep playing.

**What you earn and how:**

| Reward | Earned by | Spent on or unlocks |
| --- | --- | --- |
| Gold | Every match (more for wins, stars and big streaks) | Leveling up cards, buying chests |
| Chests | Campaign wins (better chests for 3 stars), first win of the day | Random ball and gear cards |
| Cards | Opening chests | Balls and gear; duplicates plus gold level them up |
| Player XP and level | Every shot, make and match | Cosmetics: hair styles, and later shirts, pants and shoes |
| Achievements | One-time goals (10-make streak, win in overtime, beat a boss without sabotage) | Gold and a badge on your profile |

**Chest tiers** (rarity odds tuned later):

| Chest | How you get it | Opening |
| --- | --- | --- |
| Wooden | 1-star campaign win | 2 cards, mostly common |
| Silver | 2-star win or daily first win | 3 cards, a rare likely |
| Gold | 3-star win or beating a boss | 4 cards, an epic likely |
| Legendary | Rare drop or a long win streak | 5 cards, at least one legendary |

The chest opening uses the same casino feel as power-up picks: shaking, a glow in the best rarity's color, and cards flipping one at a time.

## Online 2-player

Online play is very doable for this game, because each player shoots at their own hoop. The two computers never share a ball, so each one runs its own physics, and they only send each other small messages: scores, sabotage cards, the fan meter and the clock. A little lag doesn't break anything.

**How a match would work:**

1. Player 1 clicks "Host online" and gets a short room code.
2. Player 2 types the code and the two browsers connect directly.
3. The host runs the clock, coin flip, power-up rolls and fan meter, and sends them to the guest, so both screens agree.
4. Each player shoots on their own computer and sends "I scored 2", "I missed" or "I picked Tiny Rim on you".
5. The opponent's court shows in the small view, driven by those messages.

**Ways to connect:**

| Option | How it works | Cost and setup | Fit |
| --- | --- | --- | --- |
| PeerJS (recommended) | Browsers connect directly with WebRTC; a free PeerJS cloud server only does the handshake, and data goes straight between players | Free; add one script tag | Best for a class project: no server to run |
| Own small server | A Node.js WebSocket server that relays messages | Free tiers exist but sleep when idle; more to set up | Better later if you want matchmaking or leaderboards |
| Same Wi-Fi only | Direct connection inside one network | Free | Too limited: only works in the same room |

**Two things to know:**

- **The game needs a public link first.** GitHub Pages only works on private repos with a paid GitHub plan, so either make the repo public or host it on another free static host. Both players open that link.
- **Some networks block direct connections** (strict school or office Wi-Fi). PeerJS's cloud offers a free relay for those cases, but school networks that block its port won't work.

Sources: [PeerJS](https://peerjs.com/), [PeerJS docs](https://www.peerjs.com/docs), [PeerJS FAQ](https://peerjs.com/client/faq), [GitHub Pages plan limits](https://hostsmith.net/blog/github-pages-private/)

## More features

**Next up** (decided Nov 15, in this order):

| Feature | What it is |
| --- | --- |
| Daily challenge | One set map, difficulty and power-up order per day, the same for everyone, with its own daily leaderboard |
| Instant replay | Buzzer-beaters, deep threes and game-winners replay in slow motion from a cinematic angle |
| Post-game stats | Shot chart (makes and misses by spot), shooting %, best streak, power-ups used |
| Challenge codes | After a game you get a short code; a friend enters it to play the same map and power-ups and try to beat your score (no online needed) |

**Third roll: match modifier.** Once per match, a third reel spins next to the buff and sabotage cards at one of the first four power-up picks. It's a guaranteed match modifier with no choice. Both players see it roll, it's the same modifier for both, and its effect is spelled out on screen. It lasts for the rest of the game and is the one change to the game's dynamic for that match. It never rolls again that match.

**Which pick it shows up at** is decided secretly at the start of the game, so it always lands within the first four picks. The modifier does nothing until it shows up in the game.

| Pick | Chance the modifier shows up here |
| --- | --- |
| Pick 1 | 15% |
| Pick 2 | 20% |
| Pick 3 | 50% |
| Pick 4 | 15% |

- No match modifiers in the campaign (for now). Quick Play and multiplayer only.
- The modifiers themselves will be designed later by Justin. Build the system now (the roll, the reel, the on-screen effect text) so new modifiers can be added to a list later.

**Future, bigger: weekly modifiers.** A rule that changes the whole game for a week (low gravity, every pick is a gamble card, and so on). Could grow into a full events system later; not scheduled yet.

**Dropped:** a buzzer-beater bonus.

## Order of work and open questions

1. **Finish Stage 2** (the next-steps work list), so the graded game is solid.
2. **Power-up revamp:** Justin writes his cards in the template above; Claude reviews them for balance and clarity; then they get built.
3. **Leaderboards:** per-map high score and combo boards, split by difficulty (see Leaderboards). The new pick odds go in with the power-up revamp.
4. **Next features:** daily challenge, instant replay, post-game stats, challenge codes (see More features), plus the match-modifier third roll.
5. **Reward system:** chests, gold, levels and achievements on top of the existing cards.
6. **Online 2-player:** public link first, then PeerJS rooms, then playtests between two homes.

- [ ] Public repo, or a different free host for the public link?
- [ ] Should online matches use the multiplayer power-up odds, and do online wins earn rewards?
- [ ] Do cosmetics (hair, later shirts and shoes) come from levels, chests, or both?
- [ ] How many power-ups in the new set: a tight 20, or a big pool of 40+?
