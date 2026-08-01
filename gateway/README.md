# Gameboi KSR Gateway

This Cloudflare Pages Function gives the Gameboi services a clean public name without changing the shared Cloudflare account subdomain.

- Leaderboard: `https://gameboi-ksr.pages.dev/leaderboard/`
- Live relay: `https://gameboi-ksr.pages.dev/relay/`

The gateway uses private Cloudflare service bindings to reach the isolated leaderboard and relay Workers.

Deploy from this directory with Node.js 22 or newer:

```powershell
npx wrangler pages deploy
```
