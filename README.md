# KSR Gameboi SP

A screen-only retro handheld console for Second Life Media on a Prim. The web console is a static HTML, CSS, and vanilla JavaScript site hosted by GitHub Pages. It includes two cartridges:

- **Snake Byte** - a polished Snake-style game
- **Block Drop** - an original falling-block puzzle game

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

Open `http://localhost:8000/`. A local server is recommended because the console uses JavaScript modules.

## Enable GitHub Pages

1. Push this folder to a GitHub repository.
2. Open **Settings > Pages**.
3. Under **Build and deployment**, choose **Deploy from a branch**.
4. Select `main` and `/ (root)`, then save.

The expected address is:

`https://YOUR-GITHUB-USERNAME.github.io/YOUR-REPOSITORY-NAME/`

All website paths are relative, so the console works from a GitHub Pages project subdirectory and not only from a domain root.

## Second Life setup

The interface has a logical **320 x 240** game layout and scales edge-to-edge on any prim screen. The controller requests a high-quality **1024 x 1024** Media on a Prim texture; the prim face provides the final shape.

1. Place `second-life/GameBoi Mesh Controller.lsl` into the object.
2. The current test display uses **face 2**. Change `SCREEN_FACE` at the top only if the final mesh uses another face.
3. For a one-prim test, no prim naming is required.
4. For a linked final console, name the display prim `SCREEN` and the button prims `UP`, `DOWN`, `LEFT`, `RIGHT`, `A`, `B`, `START`, and `SELECT`.
5. Reset the script.

This testing controller allows everyone to click the media screen and physical mesh controls. GitHub Pages does not mirror one resident’s active browser state to another resident’s separate media browser.

## Controls

| Console | Keyboard | Action |
|---|---|---|
| D-pad | Arrow keys | Move / navigate |
| A | Z | Select / rotate |
| B | X | Back / hard drop |
| Start | Enter | Start / pause |
| Select | Shift | Exit game / back |

Choose **Turn Off** for a CRT-style shutdown animation. Click the dark screen to wake it again; Start or A also wakes it once mesh buttons are installed.

The music-note button mutes the retro sound effects. Mute state and game high scores are stored locally in the viewer’s media browser.

### Block Drop controls

- Left/Right: move
- Down: soft drop
- Up or A: rotate clockwise
- B: hard drop
- Start: pause
- Select: return to console

## Add another cartridge

1. Create `games/your-game/your-game.js` and an optional matching CSS file.
2. Export a cartridge manifest with `id`, `title`, `version`, and `create()`.
3. Implement `mount(host, services)`, `input(key, pressed)`, and `unmount()`.
4. Import the manifest in `js/console.js`, register it, and add its button to the cartridge screen.

The service object gives cartridges storage, sound, exit, and input routing without coupling a game to the console shell.
