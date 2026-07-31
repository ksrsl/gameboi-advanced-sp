# KSR Gameboi SP

A screen-only retro handheld console for Second Life Media on a Prim. The web console is a static HTML, CSS, and vanilla JavaScript site hosted by GitHub Pages. It includes nine cartridges:

- **Snake Byte** - polished classic snake action
- **Block Drop** - an original falling-block puzzle
- **Brick Blaster** - multi-level brick breaking with collectible power cores
- **Astro Defender** - a wave-based space shooter with bombs and upgrades
- **Pet Byte** - a persistent virtual pet with care, coins, and levels
- **Byte Flyer** - one-button flying with gates, coins, skins, and day/night stages
- **Road Rush** - a three-lane endless racer with boost, shields, and unlockable cars
- **Dungeon Byte** - a turn-based dungeon adventure with persistent runs
- **Fishing Byte** - timing-based fishing with rarity, records, and a saved collection

This release is GitHub-only and requires no backend.

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

The interface has a logical **320 x 240** game layout and scales edge-to-edge on any prim screen. The controller requests a high-quality **1024 x 1024** Media on a Prim texture; the prim face supplies the final shape.

1. Place `second-life/GameBoi Mesh Controller.lsl` into the object.
2. The current test display uses **face 2**. Change `SCREEN_FACE` at the top only if the final mesh uses another face.
3. For a one-prim test, no prim naming is required.
4. For a linked final console, name the display prim `SCREEN` and the button prims `UP`, `DOWN`, `LEFT`, `RIGHT`, `A`, `B`, `START`, and `SELECT`.
5. Reset the script.

The display uses click-to-zoom: the first click centers and frames the complete screen prim, and the next click interacts with the media. Press `Esc` to leave the centered view. The testing controller allows everyone to click the media screen and physical mesh controls.

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
- Down: brake
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

Select returns to the console from every cartridge.

## Add another cartridge

1. Create `games/your-game/your-game.js` and an optional matching CSS file.
2. Export a cartridge manifest with `id`, `title`, `version`, and `create()`.
3. Implement `mount(host, services)`, `input(key, pressed)`, and `unmount()`.
4. Import the manifest in `js/console.js`, register it, and add its button to the cartridge screen.

The service object gives cartridges storage, sound, exit, and input routing without coupling a game to the console shell.
