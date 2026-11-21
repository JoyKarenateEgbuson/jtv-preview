# Deploying to Cloudflare (reviews.thejoietv.com)

The app is already built and tested for Cloudflare Workers (see "What was tested"). Deploying needs a Cloudflare login, so it is a manual step.

## The one thing that needs your friend

Cloudflare only attaches a custom domain to a Worker when the Worker and the domain (`thejoietv.com`) are in the **same Cloudflare account**. The domain is in your friend's account, so pick one:

| Option | What your friend does | What you get |
|---|---|---|
| **A. Add you as a member** (recommended) | Invites you to his Cloudflare account with limited roles (below) | You deploy and update the site yourself, any time |
| **B. He deploys it** | Runs the deploy himself each time | You depend on him for every update |

For option A he goes to **Manage Account → Members → Invite**, enters your Google email, and gives these roles only (not Administrator):
- **Workers Platform Admin** (to deploy the Worker)
- **DNS** (to add the `reviews` record and certificate)

He should have two-factor login on his account, since it holds the whole domain.

### Message to send him

> Hey, I'm hosting the Joie TV review site on Cloudflare at reviews.thejoietv.com. Cloudflare only lets me attach that address if I'm a member of the account that owns thejoietv.com. Could you invite me under Manage Account > Members with just two roles: "Workers Platform Admin" and "DNS" (please don't give me Administrator)? Use my Google email. Thanks!

## Deploy steps (once you're a member)

1. In the project folder, sign in to the right account:
   ```powershell
   npx wrangler login
   ```
   If you belong to more than one account, pick his when asked.
2. Tell Claude you're a member. Claude will:
   - add the `reviews.thejoietv.com` route to `wrangler.jsonc`,
   - generate a **fresh production** admin password and session secret (not the dev ones),
   - upload your settings to Cloudflare as secrets, without printing them,
   - run `npm run deploy`.
3. Open `https://reviews.thejoietv.com`. Cloudflare creates the DNS record and HTTPS certificate itself.
4. Switch the privacy link in Google (**Auth Platform → Branding**) to `https://reviews.thejoietv.com/privacy`.

## What was tested

Everything below passed in Cloudflare's real Workers runtime on a local machine, against your real Drive and Firestore:
login and the admin guard, uploading to Drive, streaming back byte-identical with Range requests, Firestore writes, comments, downloads, and the no-token refusal.

- Worker size: 1.1 MiB compressed, under the 3 MiB free-plan limit.

## Free plan limits to know

- **10 ms of CPU per request.** Waiting on Google doesn't count, so streaming is fine. Rendering a page might occasionally brush it. If visitors ever see "Error 1102", the fix is Workers Paid (about $5/month).
- **100,000 requests a day.** A player fetches video in many small requests, so one viewing is hundreds of requests. A small team is far below the limit.
- Bandwidth through the Worker is not capped or billed.

## Updating the site later

```powershell
npm run deploy
```

To try it locally in the Workers runtime first: copy `.env.local` to `.dev.vars`, then `npm run preview`.
