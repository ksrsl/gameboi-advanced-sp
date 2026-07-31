# KSR Gameboi SP camera setup

Use `GameBoi Mesh Controller.lsl` for the web screen and mesh buttons. Add **one** camera script, never both.

## Recommended: reliable sit camera

Use `GameBoi Sit Camera Focus.lsl`. Standard Second Life grants camera-control permission reliably when the resident is seated on the scripted object.

### Single-prim test

1. Put `GameBoi Mesh Controller.lsl` and `GameBoi Sit Camera Focus.lsl` in the prim.
2. `SCREEN_LINK_NUMBER` is currently set to `2` for the linked test object. A single-prim object is detected automatically. Keep `SCREEN_FACE_NUMBER = 2` and `FOCUS_CATCHER_LINK_NUMBER = 0`.
3. Reset both scripts.
4. Right-click the prim and select **Enter Game View**.
5. Use the viewer's **Stand** button to exit.

A Shared Media face consumes left clicks and does not generate LSL `touch_start` events. Therefore, a single prim cannot use the same left click both for its web page and for its LSL camera script.

### Linked Game Boy with one-left-click focus

1. Create a very small ordinary cube prim and name it `FOCUS`.
2. Link it to the Game Boy. Keep the prim containing both scripts as the root.
3. Find the `FOCUS` link number and place it in `FOCUS_CATCHER_LINK_NUMBER`.
4. Set the correct `SCREEN_LINK_NUMBER` and `SCREEN_FACE_NUMBER`.
5. Reset the sit camera script. It sizes, rotates, positions, and makes the `FOCUS` prim invisible over a standard box face 2.
6. Left-click the screen to enter Game View. Click it again to exit.

`CATCHER_STAYS_FOR_EXIT = TRUE` keeps the invisible catcher over the screen after focusing. This is ideal when the linked D-pad, A, B, Start, and Select buttons operate the game. Set it to `FALSE` if residents must click the web page itself; they can then exit with **Stand** or an optional linked `CAMERA` button.

Only one resident is accepted at a time. Other sitters are immediately stood and told that the Game Boy is in use.

## Direct standing camera

`GameBoi Direct Camera Focus.lsl` contains the requested permission-based standing implementation. Set its `CLICK_TRIGGER_LINK_NUMBER` to a non-media button or catcher link, or leave it at `0` to use the configured screen link/face when that face has no Shared Media.

On standard Second Life, a rezzed object normally receives `PERMISSION_CONTROL_CAMERA` only while the resident is sitting on it or wearing it. Consequently, the direct version is useful for an attachment or a compatible environment, but it is not the reliable choice for a standing resident using a rezzed Game Boy. If permission is denied, it tells the resident to use the sit fallback.

## Find the link and face numbers

In Firestorm or the official viewer:

1. Right-click the Game Boy and choose **Edit**.
2. Enable **Edit Linked**.
3. Click the screen part. The edit panel shows its link number.
4. Enable **Select Face**, click the visible screen surface, and read the face index shown by the viewer.

You can also temporarily put `GameBoi Link Face Finder.lsl` in the root and touch the desired part. It prints the prim name, link number, and face number to the owner. A Media-on-a-Prim face will not report its touch; temporarily clear media from that face, or use the viewer's Select Face tool.

## Adjust the camera

Both camera scripts use the same settings:

- `SCREEN_FRONT_LOCAL`: the outward-facing local direction. Standard box face 2 is `<1.0, 0.0, 0.0>`. Use `<-1.0, 0.0, 0.0>` if the camera appears behind the display.
- `VIEW_DISTANCE`: distance straight out from the screen. Keep `0.0` for automatic tight framing. Increase it if the mesh clips into view.
- `CAMERA_HEIGHT`: positive moves the camera toward the screen prim's local top; negative moves it down.
- `CAMERA_SIDE_OFFSET`: positive moves toward local +Y; negative moves toward local -Y.
- `FOCUS_OFFSET`: local `<front, side, height>` adjustment for the point the camera looks at. Start at `<0.0, 0.0, 0.0>`.
- `MAX_INTERACTION_DISTANCE`: maximum allowed avatar-to-screen distance.
- `CAMERA_TRANSITION_TIME`: smooth movement time. `0.65` seconds is a good starting value.
- `AUTO_FRAME_SCALE`: automatic framing multiplier. Increase it to show more border; decrease it carefully for a tighter crop.
- `CAMERA_VERTICAL_FOV` and `CAMERA_VIEW_ASPECT`: automatic framing assumptions. The defaults match the 4:3 Gameboi display.

Set `DEBUG_MODE = TRUE`, reset the script, and enter Game View. The script prints the calculated region camera position, focus point, and distance to the owner. Turn debug off for release copies.

For a custom mesh, first correct `SCREEN_FRONT_LOCAL`; then tune distance, height, side, and focus offset in small steps of `0.02` to `0.05` meters.
