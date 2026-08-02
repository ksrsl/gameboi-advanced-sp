# KSR Gameboi Duo

First dual-screen interface prototype for a future KSR Second Life handheld. The product uses an original KSR visual identity with the familiar upper-display and lower-touchscreen style of classic dual-screen handhelds.

## Preview

Serve the repository root from a local web server and open:

`http://127.0.0.1:8790/duo/`

The default preview displays the complete handheld with both screens. The two Media-on-a-Prim surfaces use separate views:

- Upper screen: `duo/?screen=top`
- Lower touchscreen: `duo/?screen=bottom`

Both pages accept the same optional synchronization parameters:

`?screen=top&sync=RELAY_URL&room=DEVICE_ID&token=PRIVATE_TOKEN`

The included Second Life setup script generates these URLs automatically.

## Logical screen sizes

- Upper display: **400 x 240**
- Lower touchscreen: **320 x 240**

Each view stretches exactly to its assigned prim face without browser scrolling or empty margins. For sharp Media-on-a-Prim rendering, configure at least 1024 pixels of media width.

## Current features

- Coordinated upper and lower interfaces
- Animated KSR Duo boot sequence
- Two-page touch launcher with twelve applications
- D-pad and keyboard navigation
- Touch selection and swipe paging
- Application preview panels
- Pearl, Midnight, and Sunset themes
- System sound and mute setting
- Sleep and wake animation
- LocalStorage preferences
- BroadcastChannel/local synchronization
- Optional Cloudflare live-room synchronization
- Separate production URLs for both Second Life screen faces

## Controls

- Arrow keys: move through application tiles
- Z or Enter: open selected application
- X, Shift, or Backspace: return home
- Q/E: previous or next launcher page
- Touch an icon once: select it
- Touch the selected icon again or press Open: launch it
- Swipe the touchscreen: change launcher page

## Second Life setup

1. Link the two display prims into the handheld.
2. Name the upper display prim `TOP SCREEN`.
3. Name the lower touch display prim `TOUCH SCREEN`.
4. Put `second-life/KSR Gameboi Duo Screen Setup.lsl` into the root/body prim.
5. Set `TOP_SCREEN_FACE` and `TOUCH_SCREEN_FACE` at the top of the script.
6. Reset the script.

The top screen is view-only. The lower screen is owner-interactive by default. Both receive the same device room and private relay token.

