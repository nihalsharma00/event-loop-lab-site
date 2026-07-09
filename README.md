# Event Loop Lab

A single-page, dependency-free interactive visualization of the JavaScript event loop
(Call Stack, Web APIs, Microtask Queue, Macrotask Queue, and the Event Loop itself).

Everything lives in `index.html` — no build step, no npm install, no framework.

## Deploy on GitHub + Vercel

1. **Create a new GitHub repo** (e.g. `event-loop-lab`) and push these files:
   ```bash
   git init
   git add .
   git commit -m "Event Loop Lab"
   git branch -M main
   git remote add origin https://github.com/<your-username>/event-loop-lab.git
   git push -u origin main
   ```
2. **Import it on Vercel:**
   - Go to https://vercel.com/new
   - Select "Import Git Repository" and pick your `event-loop-lab` repo
   - Framework Preset: choose **Other** (or leave it on "Other" if auto-detected) — no build command, no output directory needed, since `index.html` is served as-is
   - Click **Deploy**

That's it — Vercel will serve `index.html` at your project's root URL.

## Run locally

Just open `index.html` directly in a browser, or serve it with any static server, e.g.:
```bash
npx serve .
```
