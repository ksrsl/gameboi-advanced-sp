# GameBoi Advanced SP

A static, screen-only 320 × 240 retro handheld interface made for Second Life Media on a Prim. The physical console and controls are supplied by the in-world mesh. The first cartridge is **Snake Byte**. It uses only HTML, CSS, and vanilla JavaScript—no build step, framework, or backend.

## Run locally

Serve the project directory with any static web server. For example, with Python installed:

```powershell
python -m http.server 8000
```

Open `http://localhost:8000/`. Opening `index.html` directly may work, but a local server is recommended because the console uses JavaScript modules.

## Enable GitHub Pages

1. Push this folder to a GitHub repository.
2. Open the repository's **Settings → Pages**.
3. Under **Build and deployment**, choose **Deploy from a branch**.
4. Select the `main` branch and `/ (root)`, then save.

The expected address is:

`https://YOUR-GITHUB-USERNAME.github.io/YOUR-REPOSITORY-NAME/`

All project paths are relative, so the console works from a GitHub Pages project subdirectory as well as a domain root.

## Second Life Media on a Prim

Use the same public GitHub Pages address above as the Media URL. Set the media surface to **320 × 240 pixels** (4:3). The included `second-life/GameBoi Mesh Controller.lsl` script configures this automatically.

## Mesh controller setup

1. Link the screen and button meshes into one object.
2. Name the linked prims exactly: `SCREEN`, `UP`, `DOWN`, `LEFT`, `RIGHT`, `A`, `B`, `START`, and `SELECT`.
3. Put `second-life/GameBoi Mesh Controller.lsl` in the root prim.
4. `SCREEN_FACE` currently defaults to face 2. Change it at the top of the script if your final display uses another face.
5. Reset the script. It installs the Media on a Prim URL and reports that the screen is connected.

The controller changes only the URL fragment for each input. The loaded page listens for those fragment changes, so button commands do not require a backend or full page reload in a normal Shared Media browser.

Use **Edit Linked** when naming the individual mesh pieces. The name shown in local chat is the overall/root object name and does not prove that a child display prim is named `SCREEN`. Controller v1.1 also accepts an unlinked or root display whose object name is `SCREEN`.

## Controls

| Console | Keyboard | Action |
|---|---|---|
| D-pad | Arrow keys | Move / navigate |
| A | Z | Select / start |
| B | X | Back |
| Start | Enter | Start / pause |
| Select | Shift | Exit game / back |

The music-note button mutes all sounds. Mute state and the Snake high score are saved in local storage for that browser/viewer.

## Add another cartridge

1. Create `games/your-game/your-game.js` and an optional matching CSS file.
2. Export a cartridge manifest with `id`, `title`, `version`, and `create()`.
3. The created game must provide `mount(host, services)`, `input(key, pressed)`, and `unmount()` methods.
4. Import the manifest in `js/console.js`, call `registerCartridge(manifest)`, and add it to the game selection UI.

The `services` object supplies `storage`, `tone`, and `exit`, keeping cartridges independent of the console shell.
