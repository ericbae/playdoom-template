# PlayDoom Template

Deployable Cloudflare Worker template for private browser deathmatch rooms with FreeDM maps, sound effects, and shareable invite links.

This is the game template repo. The public explainer and step-by-step deploy guide lives separately at [`playdoom.ossy.dev`](https://playdoom.ossy.dev).

## Quick Start

```bash
npm install
npm run prepare:assets
npm run verify
npm run dev
```

Open `http://localhost:8787`.

## Self-Host

Deploy your own copy to your Cloudflare account:

[![Deploy to Cloudflare](https://deploy.workers.cloudflare.com/button)](https://deploy.workers.cloudflare.com/?url=https://github.com/ericbae/playdoom-template)

For the user-friendly deployment walkthrough, start at [`playdoom.ossy.dev#guide`](https://playdoom.ossy.dev#guide).

The button sends you through Cloudflare's deploy flow. You do not need to add `CLOUDFLARE_ACCOUNT_ID` or `CLOUDFLARE_API_TOKEN` to this repository for that path; Cloudflare handles account authentication during setup. Set `DOOM_KEY` when Cloudflare prompts for template secrets.

For tighter GitHub access, create an empty repository in your own GitHub account first. During Cloudflare's GitHub authorization step, grant Cloudflare access only to that empty repository, then use it as the destination for the deployed copy.

For manual setup and GitHub Actions notes, see [SELF_HOSTING.md](./SELF_HOSTING.md).

## Test

With the local dev server running:

```bash
npm run smoke
```

This checks browser engine readiness, room creation, and Durable Object WebSocket packet routing.

## Deploy

```bash
npx wrangler deploy --dry-run
npx wrangler secret put DOOM_KEY
npm run deploy
```

`DOOM_KEY` signs private room IDs. Localhost development falls back to a development key if no secret is set; deployed Workers require the secret.

## What This Uses

- Cloudflare Workers Static Assets for the site.
- Cloudflare Durable Objects for per-room WebSocket routing.
- Cloudflare's browser Doom WebSocket build as the first engine artifact.
- FreeDM from the Freedoom project as the legal Doom II-compatible IWAD.
- FreeDM maps `MAP01` through `MAP32`, with generated minimap previews.

The client preloads FreeDM as `doom2.wad` for compatibility with the older Chocolate Doom based browser build, then warps directly to the selected map.
FreeDM is about 22 MB, which keeps the IWAD under Cloudflare Workers Static Assets' 25 MiB per-file limit.

## Production Notes

The engine files are downloaded by `npm run prepare:engine` from Cloudflare's public demo deployment and documented in `public/vendor/doom/SOURCE.txt`. Before treating this as a long-lived production distribution, build the engine from the Cloudflare source repo with the matching Emscripten toolchain and publish the source/build instructions alongside the hosted binary.

Classic Doom netcode expects players to join before the match begins. This MVP supports invite links and live room routing, but reconnect and late-join behavior should be treated as a later product feature rather than a guaranteed flow.

Current multiplayer flow:

1. Host clicks `Start and get link`.
2. Host shares the invite link.
3. Other players open the link or paste it into `Join game`.
4. Host presses `Space` inside Doom after everyone is listed in the waiting room.

Players should not be expected to join after the host has started the match.

Current game rules:

- Max players: 4.
- Mode: alt-deathmatch on the host-selected FreeDM map.
- Time limit: selected by the host before starting. This uses Doom's `-timer` flag.
- Kill limit: not supported by the current vanilla-style engine artifact.
- Respawn: deathmatch respawn is handled by Doom after a player dies.
- Score: Doom keeps frags in-game and shows deathmatch stats, but the app does not yet export a persistent scoreboard.
