# Vega Providers Web App

Static frontend for browsing/testing **vega-providers** directly from GitHub.

## No clone needed

Once GitHub Pages is enabled, open:

```text
https://azim1101.github.io/vega-providers/
```

or (project pages path):

```text
https://azim1101.github.io/vega-providers/app/
```

depending on Pages source settings.

## What it does

- Loads `manifest.json` from GitHub
- Loads provider modules from `dist/<provider>/*.js`
- Shows catalogs, posts, search, meta, episodes, streams
- Works as pure HTML/CSS/JS (no build step for the frontend)

## Local preview (optional)

From repo root:

```bash
npx --yes serve app -p 5173
```

Then open `http://localhost:5173`.

## Settings

Gear icon → change GitHub `owner` / `repo` / `branch` if you fork the repo.

## CORS note

Many provider websites block browser CORS. The UI will still load provider code from GitHub, but live post/meta/stream calls may fail for sites that disallow cross-origin browser requests. This frontend is mainly for browsing provider packaging + testing modules that return JSON/public endpoints.
