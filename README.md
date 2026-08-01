# KSR Gameboi SP

A screen-only retro handheld console for Second Life Media on a Prim. The web console is a static HTML, CSS, and vanilla JavaScript site hosted by GitHub Pages. It includes twenty cartridges:

Created by KSR.

- **Snake Byte** - polished classic snake action
- **Block Drop** - an original falling-block puzzle
- **Brick Blaster** - multi-level brick breaking with collectible power cores
- **Astro Defender** - a wave-based space shooter with bombs and upgrades
- **Pet Byte** - a persistent virtual pet with care, coins, and levels
- **Byte Flyer** - one-button flying with gates, coins, skins, and day/night stages
- **Road Rush** - a three-lane endless racer with boost, shields, and unlockable cars
- **Dungeon Byte** - a turn-based dungeon adventure with persistent runs
- **Fishing Byte** - timing-based fishing with rarity, records, and a saved collection
- **Maze Muncher** - an original maze chase with power cores, four drone behaviors, and escalating levels
- **Mini Golf** - five compact courses with sand, water, par, and a saved best round
- **Pocket Tennis** - a smooth first-to-five tennis match with standard shots and lobs
- **Pixel Kart** - an original six-racer kart circuit with drifting, boosts, item boxes, and three laps
- **Survivor Byte** - an auto-fire arena roguelite with upgrades, dash, pulse attack, bosses, and escalating swarms
- **Bomb Grid** - a tactical maze battle against three CPU hunters with bombs, breakable crates, and powerups
- **Pixel Quest** - a three-world platform adventure with coins, enemies, checkpoints, and a final citadel boss
- **Battle Tanks** - a cover-based tank arena with ricochets, mines, waves, and aggressive flanking CPU tanks
- **Pocket Fighter** - a best-of-three fighting game against a CPU that blocks, counters, and controls distance
- **Street Hoops** - a timed basketball shootout with power, aim, dunks, blocks, and a competitive CPU scorer
- **Pocket Bowling** - a ten-frame bowling match with aim, power, hook, regulation bonuses, and a pro CPU opponent

This release is GitHub-only and requires no backend.

Version 3.0 is the KSR Arcade System upgrade. It adds a longer black-and-white arcade boot sequence, a readable two-page cartridge library, cartridge-specific accent lighting, sharper HUDs and title cards, glass and scanline effects, responsive input flashes, upgraded layered sound, and a lightweight mode that activates below 42 FPS in Second Life's media browser. All twenty games share the new presentation and low-latency input layer. Road Rush now draws its lane and shoulder markings in the same curved perspective as the road, eliminating the broken-looking vertical stripes. CPU opponents still use game-specific pursuit, prediction, defense, and pressure logic instead of passive random movement.

The mesh controller is version 1.8.0. Its persistent long-poll bridge now hands a completed button response directly into the next poll, removing an unnecessary browser timer between inputs while retaining the safe URL fallback.

## Public addresses

- Console: `https://ksrsl.github.io/gameboi-advanced-sp/`
- Second Life Media URL: `https://ksrsl.github.io/gameboi-advanced-sp/`

Install the included controller and let it configure the media face.

## Run locally

Serve the project directory with any static server:

```powershell
python -m http.server 8000
```

Open `http://localhost:8000/`. A local server is required because the console uses JavaScript modules.

## Enable GitHub Pages

1. Push this folder to a GitHub repository.
2. Open **Settings > Pages**.
3. Under **Build and deployment**, choose **Deploy from a branch**.
4. Select `main` and `/ (root)`, then save.

The expected public address is:

`https://YOUR-GITHUB-USERNAME.github.io/YOUR-REPOSITORY-NAME/`

All website paths are relative, so the console works from a GitHub Pages project subdirectory and not only from a domain root.

## Second Life setup

The interface has a logical **320 x 240** game layout and stretches edge-to-edge to fill the configured prim face. The controller requests a high-quality **1024 x 1024** Media on a Prim texture so it matches the existing Second Life face mapping.

1. Place `second-life/GameBoi Mesh Controller.lsl` in the **root/body prim (link 1)**, not inside the screen child prim.
2. The current test display uses **face 2**. Change `SCREEN_FACE` at the top only if the final mesh uses another face.
3. Add **one** camera script: use `second-life/GameBoi Sit Camera Focus.lsl` for reliable standard Second Life operation, or the requested standing attempt in `second-life/GameBoi Direct Camera Focus.lsl`.
4. For a one-prim test, no prim naming is required. With the recommended sit script, right-click it and choose **Enter Game View**.
5. For true one-left-click focus, link a spare child prim over the screen and enter its link number in `FOCUS_CATCHER_LINK_NUMBER`. The camera script automatically sizes, aligns, and hides it on face 2.
6. For a linked final console, name the display prim `SCREEN` and the button prims `UP`, `DOWN`, `LEFT`, `RIGHT`, `A`, `B`, `START`, and `SELECT`. An optional visible camera button can be named `CAMERA`.
7. Reset the scripts.

After reset, owner chat should report `KSR Gameboi SP FAST buttons ready on SCREEN face 2.` The controller requests a temporary secure Second Life URL and keeps one lightweight input connection open from each active media viewer. Mesh-button presses and releases are sent through that connection without navigating or reloading the screen on every press. The secure URL is recreated automatically after a region restart. Replace older copies of the controller with `GameBoi Mesh Controller.lsl` v1.8.0 so the web page receives the fastest bridge behavior and the v3.0 cache refresh.

If owner chat reports that the fast-button bridge was denied, the controller falls back to the older URL method. That fallback is suitable for menu testing but is too delayed for action games. Resetting the script usually requests a fresh bridge URL.

Second Life does not deliver LSL touch events from a Shared Media face, so the invisible `FOCUS` child prim is required for true one-left-click behavior. With the default mesh-button setup, clicking that invisible screen catcher again exits Game View. If direct web-page clicks are required, disable `CATCHER_STAYS_FOR_EXIT` and use **Stand** or the optional `CAMERA` mesh button to exit.

Detailed link/face discovery, camera adjustment, debug, and fallback instructions are in `second-life/CAMERA_SETUP.md`.

For a standard box, face 2 points along local +X and works with the included camera setting. If a custom screen mesh faces the opposite direction, change `SCREEN_FRONT_LOCAL` in the camera script from `<1.0, 0.0, 0.0>` to `<-1.0, 0.0, 0.0>`.

GitHub Pages does not mirror one resident's active media browser to another resident's viewer. Live shared game state will require the synchronization service when that feature is resumed.

## Controls

| Console | Keyboard | Action |
|---|---|---|
| D-pad | Arrow keys | Move / navigate |
| A | Z | Select / primary action |
| B | X | Back / secondary action |
| Start | Enter | Start / pause |
| Select | Shift | Exit game / back |

Choose **Turn Off** for a CRT-style shutdown animation. Click the dark screen to wake it again; Start or A also wakes it once mesh buttons are installed.

The music-note button mutes the retro sound effects. Mute state, progress, collections, and high scores are stored locally in the viewer's media browser.

### Snake Byte

- D-pad: steer
- Start: pause
- A: start or restart

### Block Drop

- Left/Right: move
- Down: soft drop
- Up or A: rotate clockwise
- B: hard drop
- Start: pause

### Brick Blaster

- Left/Right: move the paddle
- A: launch the ball
- Start: pause
- Touch/click the field: position the paddle

### Astro Defender

- Left/Right: move the ship
- A: fire
- B: use a bomb
- Start: pause
- Touch/drag the field: move and fire

### Pet Byte

- D-pad: choose an activity
- A: perform the selected activity
- Start: view status
- Touch/click an activity or pet directly

### Byte Flyer

- A, Up, or a screen click: flap
- Start: pause
- B on the title screen: choose an unlocked skin

### Road Rush

- Left/Right: change lanes
- A: boost
- Hold Down: brake, then reverse after stopping
- Start: pause
- B on the title screen: choose an unlocked car

### Dungeon Byte

- D-pad: move or attack an adjacent enemy
- A: confirm or inspect status
- B: use a potion
- Start: pause/status

The current run is saved after every turn and can be continued after reopening the cartridge.

### Fishing Byte

- A or screen press: cast, hook, and reel
- Up/Down while reeling: follow the fish
- Start: pause
- B: open the album when on shore

Fish species, best sizes, coins, and total catches are stored in the collection album.

### Maze Muncher

- D-pad: steer through the maze
- A or Start: begin or restart
- Start during play: pause

Collect every data bit, use the four power cores to disable drones, and clear increasingly fast levels. High score is saved.

### Mini Golf

- Left/Right: aim
- Up/Down: adjust shot power
- A: shoot
- B: reset the stopped ball without a penalty
- Start: pause
- Touch/click the course: aim and shoot toward that point

The lowest completed five-hole round is saved.

### Pocket Tennis

- Left/Right: move along the baseline
- A: standard swing
- B: lob
- Start: pause
- Touch/click the court: move toward the touch and swing

Matches are first to five points. The CPU anticipates the ball, covers the open court, and aims away from the player instead of returning easy center shots. Match wins are saved.

### Pixel Kart

- Left/Right: steer
- Down: brake
- A: use the held item
- Hold B while steering: drift; release B for a charged mini-boost
- B on the title screen: choose Night Circuit, Silver Coast, or Neon Foundry
- Start: pause
- Touch the left or right side of the track: steer; touch the center: use an item

Race three laps against five named original KSR rivals. Turbo, shield, and pulse items appear in boxes. The upgraded racer includes three selectable circuits, rival collisions, lap announcements, reverse, boost pads, roadside lighting, and a separate winning best time for every track.

### Survivor Byte

- D-pad: move in any direction
- A: dash through danger
- B: release a charged pulse
- Start: pause
- Touch/drag the arena: move toward the touch direction

Weapons fire automatically at the nearest threat. Collect data orbs, choose upgrades, survive escalating swarms, and defeat boss units. High score and best survival time are saved.

### Bomb Grid

- D-pad: move one grid space
- A: place a bomb
- Start: pause
- Touch beside the player: move in that direction

Break crates for range and bomb upgrades while three CPU hunters seek safe paths, pursue the player, and place their own bombs. Match wins are saved.

### Pixel Quest

- Left/Right: run
- Up or A: jump
- B: attack
- Start: pause
- Touch the upper field to jump; touch the lower sides to move

Clear three scrolling worlds, collect coins, activate checkpoints, and defeat the citadel boss. High score and the furthest world reached are saved.

### Battle Tanks

- D-pad: drive and turn
- A: fire a ricocheting shell
- B: place a mine
- Start: pause
- Touch/click the arena: aim and fire toward that point

Fight increasingly difficult waves. Enemy tanks aim ahead, strafe, flank, use cover, and vary their attack timing. High score is saved.

### Pocket Fighter

- Left/Right: move
- Up: jump
- Hold Down: block
- A: punch
- B: kick
- Down+B or quick A then B: special attack
- Start: pause

Matches are best of three. The pro CPU manages distance, blocks predictable attacks, counters openings, and uses jump and special attacks. Career wins are saved.

### Street Hoops

- Left/Right: move on the court
- Up/Down: adjust shot aim
- A once: start the power meter; A again: release the shot
- B near the hoop: dunk
- Start: pause
- Touch/click the court: move and charge or release a shot

Outscore the CPU in 45 seconds. The defender tracks the player, contests shots, and maintains scoring pressure. High score and tournament wins are saved.

### Pocket Bowling

- Left/Right: aim
- Up/Down: adjust power
- A: roll
- B: cycle straight, right-hook, and left-hook shots
- Start: pause
- Touch/click the lane: aim and roll

Bowl a full ten-frame match with strikes, spares, and tenth-frame bonus rolls against a high-scoring CPU. Personal best is saved.

## Multiplayer direction

The cartridges remain static GitHub Pages files. True play between residents is possible by adding a small WebSocket room service for shared positions, inputs, scores, and join/leave events. Pixel Kart, Pocket Tennis, Battle Tanks, Pocket Fighter, Street Hoops, and Pocket Bowling are designed so online modes can be added later. Media on a Prim sessions do not share state by themselves, so GitHub Pages alone cannot provide cross-viewer multiplayer.

Select returns to the console from every cartridge.

## Add another cartridge

1. Create `games/your-game/your-game.js` and an optional matching CSS file.
2. Export a cartridge manifest with `id`, `title`, `version`, and `create()`.
3. Implement `mount(host, services)`, `input(key, pressed)`, and `unmount()`.
4. Import the manifest in `js/console.js`, register it, and add its button to the cartridge screen.

The service object gives cartridges storage, sound, visual effects, exit, and input routing without coupling a game to the console shell.
