# Publishing documentation

If you know **Python Sphinx + autodoc**, LoungeMesh uses the same *idea* with a TypeScript/Vue stack:

| Python stack | LoungeMesh stack | Role |
|--------------|-----------------|------|
| **autodoc** / docstrings | **TypeDoc** (`npm run docs:api`) | Generate API reference from source |
| **Sphinx** + MyST/rST | **VitePress** (`docs-site/`) | Narrative guides + themed site |
| **`make html`** | **`npm run docs:build`** | One command → static `dist/` |
| **Read the Docs / GH Pages** | **`.github/workflows/docs.yml`** | CI build + deploy |

The live site is meant to live on a hostname like **`https://docs.loungemesh.com`**, separate from the app (`https://loungemesh.example.com`).

## What gets built

```bash
npm run docs:build
```

1. **TypeDoc** reads `src-vue/` and writes Markdown API pages to `docs-site/api/` (see `typedoc.json`).
2. **VitePress** compiles `docs-site/*.md`, guides, and the API tree into static HTML at `docs-site/.vitepress/dist/`.

Preview locally:

```bash
npm run docs:dev      # hot reload
npm run docs:preview  # serve the production build
```

## Automatic deploy (GitHub Actions)

Workflow: [`.github/workflows/docs.yml`](https://github.com/eventyay/loungemesh/blob/main/.github/workflows/docs.yml)

- **Triggers:** push to `main` / `master`, or manual **workflow_dispatch**
- **Does not run on every PR** (CI only checks `docs:build` compiles)
- **Publishes** the `docs-site/.vitepress/dist` folder to **GitHub Pages**

### One-time GitHub setup

1. Repo → **Settings** → **Pages**
2. **Source:** GitHub Actions (not “Deploy from branch”)
3. Optional: add a **custom domain** (e.g. `docs.loungemesh.com`) in the Pages UI after the first successful deploy

### Repository variables

Configure under **Settings → Secrets and variables → Actions → Variables**:

| Variable | Example | Purpose |
|----------|---------|---------|
| `DOCS_CNAME` | `docs.loungemesh.com` | Writes `CNAME` into the published site for custom DNS |
| `DOCS_BASE_URL` | `/` or `/loungemesh/` | VitePress `base` path (see below) |

The deploy workflow runs `npm run docs:build` with `DOCS_BASE_URL` so asset links match where the site is hosted.

**Custom domain (`docs.loungemesh.com`):** set `DOCS_CNAME` and point DNS:

- **CNAME** record: `docs` → `<user>.github.io` (GitHub shows the exact target in Pages settings), **or**
- **A/AAAA** records for apex docs as per [GitHub Pages custom domain docs](https://docs.github.com/en/pages/configuring-a-custom-domain-for-your-github-pages-site)

**Project site (`https://org.github.io/loungemesh/`):** set `DOCS_BASE_URL` to `/loungemesh/` (trailing slash required). Leave `DOCS_CNAME` empty.

### DNS vs app deploy

| Host | Deployed by | Content |
|------|-------------|---------|
| `loungemesh.example.com` | CI deploy job (`ci.yml`, Docker, etc.) | Vue SPA (`dist/`) |
| `docs.loungemesh.com` | `docs.yml` | VitePress static site only |

Docs and app are **two static sites**; only the docs workflow touches GitHub Pages.

## Deploy elsewhere (S3, Netlify, nginx)

Any host that serves static files works:

```bash
npm run docs:build
# upload docs-site/.vitepress/dist
```

Set `DOCS_BASE_URL` at build time if the site is not served from `/` (same as VitePress [base](https://vitepress.dev/reference/site-config#base)).

## Keeping docs in sync

- **API pages:** regenerate on every `docs:build` from TypeScript — no manual copy.
- **Guides:** edit Markdown under `docs-site/`; add sidebar links in `docs-site/.vitepress/config.ts`.
- **CI:** `ci.yml` runs `docs:build` on PRs so broken TypeDoc/VitePress fails before merge.

There is no Sphinx-style “doc coverage” metric; review guides when you add env vars, routes, or integration flows.
