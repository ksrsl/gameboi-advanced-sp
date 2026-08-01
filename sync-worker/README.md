# KSR Gameboi Real-Time Relay

This isolated Cloudflare Worker uses one hibernating Durable Object per Gameboi room. It relays menu commands, button press/release events, viewer counts, host authority, and cartridge snapshots to every media viewer connected to the same physical console.

## Endpoints

- `GET /v1/health`
- `WSS /room/:room?token=:token`

The Second Life controller automatically uses the object UUID as the room name and creates a private room token when the script starts. No manual room configuration is required.

Current production endpoint:

`https://gameboi-ksr.pages.dev/relay/`

## Behavior

- The first connected viewer is the host.
- Everyone receives the same deduplicated physical-button events.
- Only the host may publish authoritative game snapshots.
- If the host leaves, the oldest remaining viewer becomes host.
- Room state and WebSocket metadata survive Durable Object hibernation.
- Rooms accept at most 32 simultaneous media viewers.
- Origins, room names, tokens, payload sizes, and message rates are validated.

## Commands

```powershell
npm install
npm run check
npm run dev
npm run deploy
```
