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
| `src/i18n.mjs` | The locale table, the interface dictionaries, the record-translation overlays, and the per-locale path helpers. |
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
6. Steps 3–5 run once per locale: the whole page set is emitted again under the
   locale's route prefix, from the same templates and the same records.
7. `src/assets/` is copied verbatim; `.nojekyll` and one data file per locale
   are written.
8. `build()` returns `{ cfg, outDir, written, bytes, itemCount, locales }` so
   callers and tests can assert on the result instead of scraping stdout.

## Output shape

```
index.html                      hall
recipes/index.html              World Recipes gallery
recipes/<item_id>/index.html    one per record
about/index.html                build notes
zh/…                            the same four routes again, in Chinese
assets/site.css  assets/app.js
data/world-recipes.json         presentation-free content copy
data/world-recipes.zh.json      the same records, same IDs, translated text
.nojekyll
```

## Localization

English is the default locale and owns the site root; every other locale is a
route prefix — currently `zh/`. Slugs and record IDs are identical in every
locale, so switching language is a prefix swap that keeps the route, the record,
the query string, and the fragment. The locale table lives in `src/i18n.mjs`;
it is a source constant, not a configuration key.

- **Interface text fails closed.** `loadDictionaries()` checks the dictionaries
  under `content/locales/ui/` key-for-key against the default one and rejects a
  missing key, an extra key, or a blank value. The build fails; a raw dotted key
  can never reach a page. The four site strings the default locale reads from
  `config/site.config.json` must be supplied by every other locale, because the
  config file holds one language only.
- **Record text falls back visibly.** Translations are additive overlay files
  under `content/locales/items/<code>/` and `content/locales/collections/<code>/`,
  keyed by the records' own stable IDs. A missing overlay or an unfilled field
  is a normal state: the English original stands and the page renders a
  `translation-notice` saying the record is untranslated (`none`) or partly
  translated (`partial`). A list translation is all-or-nothing, so a
  half-written list never reaches a reader. The states are `source` for the
  default locale, and `none`, `partial`, or `complete` elsewhere; each one is
  also exported in the data file's `translation_state` map.
- **The language switch is a real link.** Every page emits a link to the same
  route in each locale, so the switch works with scripting disabled. With
  `app.js` present the choice is persisted in `localStorage` under
  `library-of-the-citadel.locale`, and a stored preference redirects once, via
  `location.replace`, to an href the page itself emitted — never to an invented
  route. Storage that is absent, unreadable, or refused is caught and ignored:
  the switch keeps working, unpersisted. The live query and fragment are re-read
  at refresh and at click time, so a filtered view survives the switch.
- **Filter values stay canonical English.** Only the option text is localized,
  so a shared `?region=East+Asia` URL survives a language switch.

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

`tests/locale.mjs` covers the localization layer on the same terms: dictionary
parity and its fail-closed behavior, overlay fallback and the `none`/`partial`/
`complete` states, the per-locale page sets and data files, the switch targets
on every route, and — by running `src/assets/app.js` in a `node:vm` context
against a hand-built DOM — the browser-side switch under refused, unreadable,
and absent storage.
