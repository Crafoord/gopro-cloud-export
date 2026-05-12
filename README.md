# GoPro Exporter

Download all your GoPro Cloud videos to your local machine. Parallel downloads, resume support, real-time progress UI.

## Quick start

```bash
npx gopro-exporter
```

Then open **http://localhost:3001** in your browser.

> **Requires Node.js 18+**. No other installs needed — ffmpeg/ffprobe are bundled.

## Install from source

```bash
git clone https://github.com/your-username/gopro-exporter.git
cd gopro-exporter
npm install
npm run build
npm start
```

## How to get your GoPro session cookie

The app uses your browser session to talk to the GoPro API on your behalf.

1. Open [gopro.com](https://gopro.com) and log in
2. Open DevTools — **F12** on Windows/Linux, **Cmd+Option+I** on Mac
3. Go to the **Network** tab, filter by `Fetch/XHR`
4. Click around your media library to trigger a request
5. Click any request to `api.gopro.com` → **Request Headers**
6. Find the `Cookie` header and copy its **entire value**
7. Paste it into the **Setup** tab in the app and click **Validate**

The cookie expires after a few days — if downloads stop working, repeat the steps above.

## Configuration

All settings are in the **Setup** tab:

| Setting | Description |
|---|---|
| Session Cookie | Your GoPro browser session (see above) |
| Download Folder | Where videos are saved. Click **Browse** to pick a folder. |
| Parallel Downloads | How many videos to download at once (1–8) |

## Usage

1. **Setup** — paste your cookie, pick a download folder, save
2. **Scan** — discovers all videos in your GoPro Cloud library
3. **Start** — begins downloading. Pause/resume anytime.
4. **Retry** — failed downloads can be retried individually or all at once
5. **Broken files** — mark files that are corrupt on GoPro's end to skip them permanently

## Data & privacy

- Your config and download state are stored in `~/.gopro-exporter/` on your machine
- Nothing is sent anywhere except to the GoPro API using your own session cookie
- Videos are saved to the folder you choose
