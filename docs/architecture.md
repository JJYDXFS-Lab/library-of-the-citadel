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
| `src/stories.mjs` | The same three steps for the story shelf: read `content/stories/`, validate, apply the story gates, return plain data. |
| `src/i18n.mjs` | The locale table, the interface dictionaries, the record-translation overlays, and the per-locale path helpers. |
| `src/templates/pages.mjs` | Hall, gallery, detail, and about pages as template literals. It also exports the shared chrome — `head`, `chrome`, `foot`, `noticeBanner` and the escaping helpers — so a second page family cannot drift from the first. |
| `src/templates/stories.mjs` | The shelf index and the reading page, built from that shared chrome. |
| `src/build.mjs` | Orchestrate: load, render, write, copy assets, report. |

The dependency direction is strict: neither `content.mjs` nor `stories.mjs`
imports a template, and no template reads `content/` from disk. That is what
keeps the records usable without the presentation layer.

## Build pipeline

1. `loadConfig(env)` resolves configuration and the output directory.
2. `loadContentOrThrow()` reads every record, validates it against its schema,
   then applies the cross-record rules. `loadStoriesOrThrow()` does the same for
   the story shelf, against its own schemas and its own gates. **Errors are
   collected, not thrown one at a time**, so a single run reports every problem
   in the corpus.
3. The `world-recipes` manifest's `item_ids` order is the editorial order. It
   drives the gallery sequence and the prev/next links on detail pages.
4. The output directory is deleted and rewritten.
5. Pages are emitted as directories containing `index.html` — that is what makes
   deep links and browser reloads work on a static host with no router.
6. Steps 3–5 run once per locale: the whole page set is emitted again under the
   locale's route prefix, from the same templates and the same records.
7. `src/assets/` is copied verbatim; `.nojekyll`, one data file per locale, and
   the single story-shelf data file are written.
8. `build()` returns `{ cfg, outDir, written, bytes, itemCount, storyCount,
   locales }` so callers and tests can assert on the result instead of scraping
   stdout.

## Output shape

```
index.html                      hall
recipes/index.html              World Recipes gallery
recipes/<item_id>/index.html    one per record
stories/index.html              Stories / 故事集 shelf index
stories/<story_id>/index.html   one reading page per story
about/index.html                build notes
zh/…                            the same route set again, in Chinese
assets/site.css  assets/app.js
data/world-recipes.json         presentation-free content copy
data/world-recipes.zh.json      the same records, same IDs, translated text
data/stories.json               the story shelf; one file, already bilingual
.nojekyll
```

## The story shelf

`content/stories/` is a second content type, loaded by `src/stories.mjs` and
rendered by `src/templates/stories.mjs`. It shares the chrome, the colophon and
the notice banner with the knowledge pages and nothing else. One difference
drives its shape: a story has exactly one canonical language for its body and is
never machine-translated, so it has no English original for a translation
overlay to fall back to. Each story and the shelf manifest therefore carry a
complete metadata block per interface locale inside the record, under `locales`,
and `src/stories.mjs` fails the build if one is missing. The body is single
sourced, marked with its own `lang`, and rendered identically in every locale.

```
content/schema/library-story.schema.json        one work
content/schema/library-story-shelf.schema.json  the shelf manifest
content/stories/shelf.json                      membership, by story_id
content/stories/items/<story_id>.json           the work itself
```

The shelf manifest is the definition of what is published. `src/stories.mjs`
refuses a `story_id` with no record on disk **and** a record on disk the
manifest does not list, so a file dropped into `content/stories/items/` is a
build failure rather than a page nobody meant to publish.

The gates are the mirror image of the knowledge-record ones. Where a recipe must
not quietly acquire a claim it never checked, a story must not quietly acquire a
source, an authority, or a provenance it does not have: `record_class` must be
`original-fiction`, `provenance.origin` must be `original-work`, the source list
must be empty, the author must be named, and a released story's `genre_note`
must say in every locale both what the work is and what it is not. A published
text must also not lose a paragraph, so `body_block_count` is written down and
checked against the array on every build, and an `emphasis` phrase that no
longer occurs in its block fails the build rather than rendering nothing.

The reading page is deliberately spare: the location trail, title, byline,
abstract, the language note, the text, the colophon, and one link back to the
shelf. It has no prev/next, no reader metric, no comment thread, no tracking,
and — as everywhere in this build — no external asset. The one number it ends on
is the shelf's own census, the same count the shelf index shows: a shelf holding
a single work has no next work, so the return rail invents none.

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
  keystroke. The search, the region and the curated lens are three filters over
  one catalogue; `?section=` names a lens, an unknown value is dropped the same
  way an unknown region is, and the single reset clears all three.
- **The hall is a plan of rooms, and a room mark is a coordinate.** The hall
  stands exactly the public rooms it holds — currently two — as its shelf list;
  what it does not hold yet is a note under the plan rather than a card standing
  empty beside them. Each room wears a mark (`ROOM` in `src/templates/pages.mjs`,
  rendered through the `room.mark` interface string) that says where it stands
  in the hall and nothing about what it holds, the way `region.label_basis` says
  nothing about a dish. The mark is the identity a reader carries from the hall
  into a room and down to a single item.
- **One location trail on every page below the hall.** `trail()` emits an
  ordered list from the hall to the current page: the current step is never a
  link and is the page's only `aria-current="page"` outside the masthead, and
  the room step wears the room's mark. A room's own index page carries its mark
  beside its heading instead, so the mark shows exactly once per page. The
  separator is a CSS `::before`, so the markup stays a list of places rather
  than a line of slashes.
- **A detail page states its shelf coordinate.** The return rail opens with the
  record's position in the collection — "Record 7 of 16 in World Recipes" — read
  from the same manifest order `prev`/`next` walks, so the coordinate and the
  walk agree by construction rather than by a second ordering.
- **The hall is drawn as one section, not a banner over a card list.** The
  masthead, the arcade, the name cut into the wall and the two doorways are one
  elevation on one wall; the notice, the build note and everything below them
  are the paper carried out of it. The two doorways are deliberately unequal —
  the working archive gets the broad, shallow opening and a shelf rhythm
  standing inside it, the reading alcove gets the narrow, taller opening and a
  lamp — because the plan is what the reader is being shown. A room's own index
  page, and the item pages below it, reopen a band of the same wall under that
  room's arch, so the identity carries by geometry and palette rather than by a
  breadcrumb alone. On a narrow viewport the elevation becomes a walk: one arch,
  then one doorway at a time, in the plan's order.
- **Nothing is fetched.** The "hall" look is gradients, rules, and type; there
  are no web fonts, images, or third-party scripts. Brass is three tokens rather
  than one — accent, wall, and paper — because a single warm value cannot stay
  legible as small type on both parchment and walnut.
- **Responsive and accessible by construction:** a skip link on every page, one
  `<h1>` per page, a single `<main>` landmark, `aria-current` on the active nav
  item and on the current trail step, `aria-live` on the result count,
  `aria-hidden` on the decorative vault, the room spines and the numeral over
  each doorway — which repeats in figures what the room mark beside it already
  says in words — visible focus rings drawn inside the doorway that clips them,
  a `prefers-reduced-motion` opt-out, and a dark scheme that restates surfaces
  as well as ink. The trail, the hall's doorways and the record return rail all
  wrap or stack on a narrow viewport rather than clipping.

## Checks

`tests/check.mjs` uses `node:test` and `node:assert` only. It covers the
official display name on every generated page, content
integrity and the sixteen-record, three-class census (six sourced, seven
original practical notes, three fixtures), the honesty rules for each class
under tampering — including the practical-note gate and the section rules — one
canonical card per record in the catalogue, the curated-lens rendering of a
collection section and its affordance at both base paths,
base-path normalization, the output-directory guard, both the root and subpath
builds, generated link/base-path correctness, detail prev/next navigation, the
hall standing exactly its two marked public rooms, the location trail on every
page below the hall, a record page's room identity and shelf coordinate, the
search/filter/empty-state hooks, build stability, and the exclusion of run
receipts, secrets, and local paths from the output.

`tests/locale.mjs` covers the localization layer on the same terms: dictionary
parity and its fail-closed behavior, overlay fallback and the `none`/`partial`/
`complete` states, the per-locale page sets and data files, the switch targets
on every route, the translated lens heading, context and affordance label
against untranslated section membership, the browser-side lens filter, EN/ZH numeric parity for the sourced records and the
practical notes alike, the Celsius-only and 75°C poultry wording in both
languages, and — by running `src/assets/app.js` in a `node:vm` context
against a hand-built DOM — the browser-side switch under refused, unreadable,
and absent storage.

`tests/stories.mjs` covers the story shelf. Its census is an allowlist rather
than a denylist: the file writes down the one published work once, then checks
the files on disk, the manifest, the emitted routes, the shelf index and the
data export against it. That fails the same way a denylist would if an
unpublished work reached the tree, without naming anything that was not
released. Beyond the census it covers the canonical body rendered line for line
in both locales and at both base paths, the two authorial emphases surviving as
markup, the English view publishing the Chinese original — asserted as byte
equality between the two page sets' reading columns — rather than a translation
of it, the per-locale metadata parity a story needs because it has no original
to fall back to, the genre note naming both what the work is and what it is not,
the authorship/provenance/rights/publication facts, the shelf and reading-page
navigation and the language switch on both story routes, the reading page's
trail back through the marked shelf and its return rail offering exactly one way
off the page with no fabricated next work, the return link, the
exact footer credit with both holders linked, each honesty gate under tampering,
the absence of operational paths and run receipts from every story source and
output file, and that the World Recipes collection did not move.
