# The Joie TV Preview

Private video preview portal for `preview.thejoietv.com`: timestamped comments, per-viewer watermark, no-download streaming, client pages and share links.

## Run locally

```powershell
npm install
npm run dev
```

Open <http://localhost:3000/admin>. The dev admin password is in `.env.local` (`ADMIN_PASSWORD`). With no Google keys set, videos and data are stored in `.data/` on this computer.

## How it works

- **Storage:** Google Drive (your own space). Videos stay private; the site streams them with HTTP Range requests, so the original file link is never exposed.
- **Data:** Firestore (free tier) for clients, links and comments.
- **Access:** one admin password; clients get a private page `/c/<token>`; anyone else gets a share link `/s/<token>`. Every video request carries a signed, expiring token.
- **Rules:** guests and share links are always watermarked with no download. Clients follow each video's settings.

Go live: [docs/SETUP.md](docs/SETUP.md) (Google Drive + Firestore), then [docs/DEPLOY.md](docs/DEPLOY.md) (Cloudflare).

## Code map

| Path | What |
|---|---|
| `src/lib/storage.ts` | Drive/local upload and the byte-range streaming proxy |
| `src/lib/db/` | Firestore (REST) and local JSON stores behind one interface |
| `src/lib/access.ts` | Viewer tokens and what each role may do |
| `src/components/VideoPlayer.tsx` | Frame-accurate player, watermark enforcement |
| `src/components/ReviewRoom.tsx` | Player + comments |
| `src/lib/session.ts` | Admin session; `requireAdminPage()` guards every admin page |
| `wrangler.jsonc`, `open-next.config.ts` | Cloudflare Workers deployment |
