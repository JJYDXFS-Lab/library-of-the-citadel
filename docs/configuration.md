# Configuration

Precedence: **environment variable > `config/site.config.json` > built-in
default**. Nothing in `src/` knows a repository name, a remote URL, or a host.

## Keys

| Config key | Environment override | Meaning |
| --- | --- | --- |
| `siteName` | `LIBRARY_SITE_NAME` | Wordmark and `<title>` suffix. Officially **Library of the Citadel**, in both `config/site.config.json` and the built-in default; the override exists for previews, not for renaming the project. |
| `siteNameAlt` | — | Secondary wordmark; omitted when empty. |
| `tagline` | — | Hall subtitle. |
| `basePath` | `LIBRARY_BASE_PATH` | Path the site is served from. |
| `citadel.url` | `LIBRARY_CITADEL_URL` | Backlink target. |
| `citadel.label` | `LIBRARY_CITADEL_LABEL` | Backlink label. |
| `buildNotice` | — | Honesty banner on the hall and about pages. |
| `footerNote` | — | Colophon line. |
| — | `LIBRARY_OUT_DIR` | Output directory, relative to the repository. Default `dist`. |

## Base paths

A base path is stored in one canonical shape — `/` for root, or `/segment/`
with both slashes. `normalizeBasePath()` accepts the sloppy forms an operator is
likely to type (`library-preview`, `/library-preview`) and normalizes them, which
is what keeps the rest of the build from branching on the base path at all.

Every emitted link is composed through `withBase()`, so the same source produces
a correct site at either:

```sh
npm run build          # basePath "/",                 -> dist/
npm run build:preview  # basePath "/library-preview/", -> dist-preview/
```

`withBase()` throws if handed a path that is already absolute, so a template
cannot accidentally emit a link that only works at the root.

## Locales

**Locales are not configurable.** There is no config key and no environment
override for them: the locale table — code, `html lang`, route prefix, endonym —
is a source constant in `src/i18n.mjs`. English is the default and owns the
site root; Chinese is served from the `zh/` prefix under whatever base path is
configured, so a preview build serves `/library-preview/zh/recipes/`.

The four configured site strings — `tagline`, `buildNotice`, `footerNote`, and
`citadel.note` — are read from `config/site.config.json` for the default locale
only, because that file holds one language at a time. Every other locale must
supply them as `site.tagline`, `site.build_notice`, `site.footer_note`, and
`site.citadel_note` in its dictionary under `content/locales/ui/`, and the build
fails if one is missing. `siteName`, `siteNameAlt`, and the Citadel backlink
label are shared across locales as configured.

The reader's own language choice is a browser concern, not a build one: it is
stored in `localStorage` under the key `library-of-the-citadel.locale` and never
consulted at build time.

## The output directory

The build **deletes its output directory before writing it**. `resolveOutDir()`
therefore refuses any value that is empty, resolves to the repository root,
escapes the repository, or points into `src`, `content`, `config`, `docs`,
`tests`, `.git`, or a run-receipt directory. Use a dedicated directory such as
`dist` or `dist-preview`.

## The Citadel backlink

`citadel.url` is empty by default and the header renders a visible but inert
placeholder. The build never invents a destination. Set the value once an owner
provisions the address.

## Deployment

The output is static files. Serve `dist/` (or `dist-preview/`) with any static
host; `.nojekyll` is written so a Jekyll-based host does not drop
underscore-prefixed paths. Detail pages are real directories with `index.html`,
so deep links and reloads work without a router or a server process.

## GitHub Pages workflow

The canonical repository is
`https://github.com/JJYDXFS-Lab/library-of-the-citadel.git`.
`.github/workflows/pages.yml` runs on pushes to `main` and manual dispatch.
It uses Node.js 24, runs `npm run check`, then builds with
`LIBRARY_BASE_PATH=/library-of-the-citadel/ npm run build`. There is no dependency
installation step. Only `dist/` is uploaded; source documentation (including
`CLAUDE.md`), private run receipts, and logs must never enter that artifact.

In the repository's **Settings → Pages → Build and deployment**, select
**GitHub Actions** as the source. Preserve any existing custom-domain settings;
this workflow does not create one or automatically enable Pages. The deployment
job uses the `github-pages` environment with only `pages: write` and
`id-token: write`; the build job has `contents: read` only.

The expected default URL is
`https://jjydxfs-lab.github.io/library-of-the-citadel/`, but it is not a verified
live site until the Actions deployment succeeds and the served pages/assets are
checked. See `STATUS.md` for the factual checkpoint. The Citadel backlink remains
unset, and all three recipe records remain illustrative fixtures.
