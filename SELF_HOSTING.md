# Self-Hosting

This project is designed to be deployed by each host to their own Cloudflare account.

## One-Click Deploy

After this repository is public on GitHub or GitLab, use this button:

[![Deploy to Cloudflare](https://deploy.workers.cloudflare.com/button)](https://deploy.workers.cloudflare.com/?url=https://github.com/ericbae/playdoom-template)

Cloudflare will clone the repository into the user's Git account, provision the Durable Object binding from `wrangler.jsonc`, run the deploy command from `package.json`, and publish the Worker on that user's account. This flow does not require the user to manually add `CLOUDFLARE_ACCOUNT_ID` or `CLOUDFLARE_API_TOKEN` as GitHub secrets.

During setup, set `DOOM_KEY` to a random value:

```bash
openssl rand -hex 32
```

## Manual Deploy

```bash
git clone https://github.com/ericbae/playdoom-template.git
cd playdoom-template
npm install
npx wrangler login
npx wrangler secret put DOOM_KEY
npm run deploy
```

The app will deploy to a `*.workers.dev` URL unless the user configures a custom domain.

## Optional GitHub Actions Deploy

The repository includes `.github/workflows/deploy.yml` for users who want to deploy from their fork with GitHub Actions instead of Cloudflare's deploy-button flow. In that case, the self-hosting user adds these secrets to their own fork:

- `CLOUDFLARE_ACCOUNT_ID`
- `CLOUDFLARE_API_TOKEN`

The API token should have permission to edit Cloudflare Workers on the target account.

## What The User Pays For

Each self-hosting user pays Cloudflare directly for their own Worker usage. For small friend-group games, the Cloudflare free tier may be enough. Larger usage can require Workers Paid.

## Important Limits

- Max playable players: 4.
- Players should join before the host starts the match.
- Static assets include the FreeDM WAD and the WebAssembly engine.
- The deploy script downloads legal FreeDM assets and the current engine artifact before deploying.
