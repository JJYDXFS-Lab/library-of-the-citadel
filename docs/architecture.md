# Architecture

The project is **Library of the Citadel** — distinct from Atom-KB's separate
Library. Nothing in the pipeline below reads from or writes to Atom-KB.

## Shape

```
content/ + config/  ──►  src/build.mjs  ──►  dist/ (static files)
```

One direction, no runtime. The deployed output is HTML, one stylesheet, one
script, a `.nojekyll` marker, and a JSON copy of the content.

## Modules

| Module | Responsibility |
| --- | --- |
| `src/config.mjs` | Resolve configuration (env > file > default), normalize the base path, build `withBase()`, and resolve a safe output directory. |
| `src/schema-validate.mjs` | Interpret the JSON Schema subset the content schemas use. |
| `src/rules.mjs` | Cross-record rules JSON Schema cannot express: referential integrity and the honesty gates. |
| `src/content.mjs` | Read `content/`, validate, apply rules, return plain data. |
| `src/templates/pages.mjs` | Hall, gallery, detail, and about pages as template literals. |
| `src/build.mjs` | Orchestrate: load, render, write, copy assets, report. |

The dependency direction is strict: `content.mjs` never imports a template, and
no template reads `content/` from disk. That is what keeps the records usable
without the presentation layer.

## Build pipeline

1. `loadConfig(env)` resolves configuration and the output directory.
2. `loadContentOrThrow()` reads every record, validates it against its schema,
   then applies the cross-record rules. **Errors are collected, not thrown one
   at a time**, so a single run reports every problem in the corpus.
3. The `world-recipes` manifest's `item_ids` order is the editorial order. It
   drives the gallery sequence and the prev/next links on detail pages.
4. The output directory is deleted and rewritten.
5. Pages are emitted as directories containing `index.html` — that is what makes
   deep links and browser reloads work on a static host with no router.
6. `src/assets/` is copied verbatim; `.nojekyll` and `data/world-recipes.json`
   are written.
7. `build()` returns `{ cfg, outDir, written, bytes, itemCount }` so callers and
   tests can assert on the result instead of scraping stdout.

## Output shape

```
index.html                      hall
recipes/index.html              World Recipes gallery
recipes/<item_id>/index.html    one per record
about/index.html                build notes
assets/site.css  assets/app.js
data/world-recipes.json         presentation-free content copy
.nojekyll
```

## Presentation decisions

- **Every internal link goes through `cfg.withBase()`.** No template writes a
  leading-slash path, so the same templates emit a correct site at `/` and at
  any subpath. `withBase()` throws on an absolute path or URL rather than
  silently producing a broken link.
- **Search and filtering are progressive enhancement.** With `app.js` absent
  every card still renders and every link still resolves; a `<noscript>` note
  says so. The script binds to `data-*` hooks, never to presentational classes.
- **Filter state lives in the query string** via `replaceState`, so a filtered
  view can be shared and survives reload without one history entry per
  keystroke.
- **Nothing is fetched.** The "hall" look is gradients, rules, and type; there
  are no web fonts, images, or third-party scripts.
- **Responsive and accessible by construction:** a skip link on every page, one
  `<h1>` per page, a single `<main>` landmark, `aria-current` on the active nav
  item, `aria-live` on the result count, `aria-hidden` on the decorative vault,
  visible focus rings, a `prefers-reduced-motion` opt-out, and a dark scheme
  that restates surfaces as well as ink.

## Checks

`tests/check.mjs` uses `node:test` and `node:assert` only. It covers the
official display name on every generated page, content
integrity and the exactly-three-fixtures invariant, the honesty rules under
tampering, base-path normalization, the output-directory guard, both the root
and subpath builds, generated link/base-path correctness, detail prev/next
navigation, the search/filter/empty-state hooks, build stability, and the
exclusion of run receipts, secrets, and local paths from the output.
