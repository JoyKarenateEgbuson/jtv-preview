# Going live: Google setup

The app already runs locally with no Google account (videos go to `.data/videos`, data to `.data/db.json`). These steps switch it to **Google Drive** for videos and **Firestore** for comments and clients. Both are free for this usage and use no card.

> The Google steps below have **not been tested end to end yet**, because they need your Google account. If any screen looks different, tell me what you see and I'll adjust the code or the steps.

## 1. Create a Google Cloud project

1. Go to <https://console.cloud.google.com> and sign in with the Google account that has your AI Plus storage.
2. Top bar → project picker → **New project** → name it `jtv-reviews` → **Create**.

## 2. Google Drive (video storage)

The app uploads and streams videos as *you*, so they count against your own Drive storage. It uses the narrow `drive.file` permission, so it can only see files it created itself, in a folder called **JTV Reviews**.

1. **APIs & Services → Library** → search **Google Drive API** → **Enable**.
2. **APIs & Services → OAuth consent screen** (may be called *Google Auth platform*):
   - User type **External**, app name `JTV Reviews`, your email for support and developer contact.
   - **Data access / Scopes** → add `https://www.googleapis.com/auth/drive.file`.
   - Under **Audience**, click **Publish app** (status *In production*). This matters: if it stays in *Testing*, Google expires the token after 7 days. `drive.file` is a non-sensitive scope, so no verification is needed.
3. **APIs & Services → Credentials → Create credentials → OAuth client ID**:
   - Application type **Web application**.
   - Authorised redirect URI: `https://developers.google.com/oauthplayground`
   - Copy the **Client ID** and **Client secret**.
4. Get your refresh token at <https://developers.google.com/oauthplayground>:
   - Click the ⚙ gear → tick **Use your own OAuth credentials** → paste the Client ID and secret.
   - In the left box type `https://www.googleapis.com/auth/drive.file` → **Authorize APIs** → sign in. If Google warns the app is unverified, choose **Advanced → Go to JTV Reviews**.
   - **Exchange authorization code for tokens** → copy the **Refresh token**.
5. Put the three values in `.env.local`:
   ```
   GOOGLE_OAUTH_CLIENT_ID=...
   GOOGLE_OAUTH_CLIENT_SECRET=...
   GOOGLE_OAUTH_REFRESH_TOKEN=...
   ```

## 3. Firestore (comments, clients, share links)

1. Go to <https://console.firebase.google.com> → **Add project** → **choose your existing `jtv-reviews` project** → keep the free **Spark** plan.
2. **Build → Firestore Database → Create database**: *Standard* edition, region closest to you, **production mode** (the app talks to it only through the server, so the default locked rules are right).
3. **Project settings (gear) → Service accounts → Generate new private key**. A `.json` file downloads.
4. Convert it to base64 so it fits on one line. In PowerShell (replace the path):
   ```powershell
   [Convert]::ToBase64String([IO.File]::ReadAllBytes("C:\path\to\key.json")) | Set-Clipboard
   ```
5. Paste it into `.env.local`:
   ```
   GOOGLE_SERVICE_ACCOUNT_JSON=<paste>
   ```
6. **Delete the downloaded `.json` file.** Anyone with it has full access to your data.

## 4. Restart and check

Restart `npm run dev`. The yellow "Dev mode" bar in the admin disappears once both Google parts are connected. Upload a short test video, then check Drive for a **JTV Reviews** folder.

## 5. Hosting and the domain

Not set up yet. This is the next decision:

- **Vercel** is the simplest for Next.js. Its free Hobby plan is officially for non-commercial use, so check it fits your business.
- **Cloudflare** is free for commercial use but needs an extra adapter that I'd add and test.

Either way, set these environment variables on the host: everything in `.env.example` (generate a fresh `ADMIN_PASSWORD` and `SESSION_SECRET`; do not reuse the dev ones). Then add a **CNAME** record for `reviews` in your `thejoietv.com` DNS pointing at the host's target.

## Known limits

- Screen recording cannot be blocked on the web. The watermark with the viewer's name is the deterrent. It is an overlay, not burned into the file, so a determined person with dev tools could strip it. The player stops playback if it detects that.
- Upload an **H.264 MP4**. There is no server-side transcoding (that would cost money).
- Streaming goes through the host, so the host's free bandwidth cap applies.
- Not built yet: drawing on frames, attachments on comments, side-by-side version compare, folders and custom metadata, comment copying between videos, password-protected links.
