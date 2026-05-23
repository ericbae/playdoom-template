# Product Packaging

There are two separate products:

1. `playdoom.ossy.dev`: the installer website.
2. The game template Worker: the thing that runs on each user's Cloudflare account.

## Recommended MVP Flow

Use Cloudflare's Deploy to Cloudflare flow instead of collecting Cloudflare API keys.

1. User visits `https://playdoom.ossy.dev`.
2. User clicks `Deploy to my Cloudflare`.
3. The installer sends them to Cloudflare's deploy URL:

   ```text
   https://deploy.workers.cloudflare.com/?url=https://github.com/ericbae/playdoom-template
   ```

4. Cloudflare authenticates the user.
5. Cloudflare clones the game template repo into the user's GitHub/GitLab account.
6. Cloudflare provisions the Worker resources from `wrangler.jsonc`, including Durable Objects and Static Assets.
7. Cloudflare deploys the user's Worker and shows them their `*.workers.dev` URL.
8. User opens their URL and plays.

This keeps user credentials out of `playdoom.ossy.dev`.

## Fully Branded Flow

If `playdoom.ossy.dev` must authenticate the user and return the deployed game URL inside our own UI, then we need a backend deploy service.

That service would:

1. Ask the user for a Cloudflare account ID.
2. Ask the user to create a scoped Cloudflare API token.
3. Use the token once to run a deploy job.
4. Store only the resulting Worker URL and deployment metadata.
5. Delete the token immediately after deployment.

Do not ask for or store a Cloudflare Global API Key.

## Why Not Store Cloudflare Keys?

If we accept Cloudflare credentials, we become responsible for:

- Token storage security.
- Token revocation UX.
- Abuse handling.
- Deploy failure recovery.
- Permission scoping.
- Customer support for Cloudflare account states.

The deploy-button flow avoids that entire surface.

## Installer Site Responsibilities

`playdoom.ossy.dev` should be a small static/Worker app:

- Explain that the game deploys to the user's Cloudflare account.
- Link to the Deploy to Cloudflare flow.
- Show the current limits: 4 players, join before start, FreeDM assets, sound effects, time limit.
- Optionally let users paste their deployed URL so we can show it in a dashboard or copy/share UI.

## Game Template Responsibilities

The game template repo must stay one-click deployable:

- `package.json` deploy script prepares assets and runs `wrangler deploy`.
- `wrangler.jsonc` defines Static Assets and Durable Objects.
- `DOOM_KEY` is documented as the only required secret.
- Asset scripts download legal FreeDM and engine artifacts.

## Future Backend Deploy Service

Only build this after the deploy-button flow is validated.

Suggested endpoints:

- `POST /deployments`: create deployment job from account ID and API token.
- `GET /deployments/:id`: poll job status.
- `DELETE /deployments/:id/token`: explicit token deletion, also done automatically.

Suggested stored data:

- deployment ID
- user email or app user ID
- Cloudflare account ID
- Worker name
- Worker URL
- deploy status
- deploy logs
- timestamps

Do not store raw API tokens after the job completes.

## MVP Public Copy

Use this positioning:

> Deploy a private browser deathmatch room to your own Cloudflare account. No server setup. Share the URL with friends.

Avoid this positioning:

> Official Doom hosting.

The game uses FreeDM/Freedoom assets and a GPL Doom-compatible engine artifact. Keep trademarked Doom branding out of paid/public marketing.
