# KSR GameBoi Leaderboard Service

This isolated Cloudflare Worker and D1 database store one best result per Resident UUID and game. Public leaderboard responses include the Resident username but never expose Resident UUIDs.

## Endpoints

- `GET /v1/health`
- `GET /v1/games`
- `GET /v1/leaderboard/:gameId?limit=10`
- `POST /v1/scores`

## Deployment

1. Authenticate Wrangler with `npx wrangler login`.
2. Create the database: `npx wrangler d1 create ksr-gameboi-leaderboard-db`.
3. Put the returned database ID in `wrangler.jsonc`.
4. Apply migrations: `npx wrangler d1 migrations apply ksr-gameboi-leaderboard-db --remote`.
5. Deploy: `npx wrangler deploy`.

The public GitHub Pages site remains separate. Only leaderboard records are handled by this service.

Current production endpoint:

`https://gameboi-ksr.pages.dev/leaderboard/`

The D1 database ID in `wrangler.jsonc` is a public resource identifier, not a password or API credential. Authentication remains in Wrangler's user-level OAuth storage and is never committed to this repository.
