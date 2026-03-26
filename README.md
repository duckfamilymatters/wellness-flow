# Wellness Flow MVP

A local-first, offline-capable web app for daily wellness practice.

## What this MVP includes
- Separate daily screen and exercise management screen
- Exercise pool management (add/delete exercises with title + guidance)
- Built-in starter exercise collection from `《中道》的练习`
- Bulk exercise import from `.docx`, `.txt`, or `.md` using `練習：<title>` format
- Random pick for today's exercise
- Log as `Completed` or `Not completed`
- Optional mood rating and notes for each day
- Calendar view with completion-only color progression across each month
- Weekly stats and current streak
- Offline use with service worker + local storage

## Run locally
From this folder:

```bash
python3 -m http.server 8080
```

Then open:
- `http://localhost:8080` on your MacBook browser
- On phone (same Wi-Fi): `http://<your-mac-local-ip>:8080`

## Deploy and install
To stop depending on a local terminal server, deploy these static files to a static host such as GitHub Pages, Netlify, Vercel, or Cloudflare Pages.

After deployment:
- Open the hosted URL on Mac or phone
- Install as a PWA from the browser
- Keep in mind that local browser storage stays per device until sync is added later

PWA install:
- iPhone/iPad Safari: `Share -> Add to Home Screen`
- Mac Chrome or Edge: use the install app button in the address bar

## Data storage
All data is stored in your browser `localStorage` on each device.

## Bulk import format
Supported files:
- Word `.docx` (including Google Docs exported as Word)
- Plain text `.txt`
- Markdown `.md`

Expected structure in file:
- One title line that starts with `練習：`
- Guidance content in the next one or more lines
- One empty line after each exercise block

Example:
```text
練習：Body Scan
Sit quietly and move your attention from head to toe.
Notice sensations without judging.

練習：Breathing Anchor
Breathe in for 4 counts and out for 6 counts.
Repeat for 3 minutes.
```

Google Docs note:
- A `.gdoc` pointer file from Drive is not importable directly.
- In Google Docs, use `File -> Download -> Microsoft Word (.docx)` or `Plain Text (.txt)` first.

## Phase 2 ideas
- Export/import backup for full data (exercise pool + logs)
- Multi-device sync
- Optional accounts
