# Content schema

Records are plain JSON under `content/`. The schemas in `content/schema/` are
ordinary JSON Schema documents, so the records stay portable to any validator.

- `library-item/1.0.0` — `content/schema/library-item.schema.json`
- `library.collection/1.0.0` — `content/schema/library-collection.schema.json`
- `library.story/1.0.0` — `content/schema/library-story.schema.json`
- `library.story-shelf/1.0.0` — `content/schema/library-story-shelf.schema.json`

The first two describe knowledge records; the last two describe literary works,
which are a different kind of thing and have a different contract. See
*[Stories](#stories)* below.

Schema `$id`s, `schema_version` values, `item_id`s, `collection_id`s,
`story_id`s, and `shelf_id`s are stable identifiers. The project's official name is **Library of the Citadel**,
but that naming decision changed only human-readable `title`/`description`
metadata — no identifier moved, so existing records keep validating unchanged.

A file under `content/items/` must be named for its `item_id`.

## Item fields

| Field | Notes |
| --- | --- |
| `schema_version`, `item_id`, `collection_id` | Identity. `item_id` is stable: never reused, never renumbered. |
| `record_class` | `fixture` (authored to demonstrate the contract), `sourced` (derived from identified sources), or `practical-note` (original everyday cooking written here, citing nothing because it claims nothing). |
| `publication_ready` | Must be `false` for a fixture and for a practical note. |
| `record_notice` | Honesty banner rendered on every view of the record. |
| `name`, `region`, `summary`, `tags` | Display and search facets. `region.label_basis` records how much weight the label carries — it is a filter facet, not an attribution claim. `source-attributed` means the cited page names the region itself; `editorial-facet` means this project assigned it for browsing and the source makes no such claim; `fixture-illustrative` is for demonstration records. |
| `variants` | Regional variants held side by side. The framework never nominates one as definitive. |
| `ingredients`, `method`, `yield_note` | `method` steps are numbered `1..n` in order. |
| `sources`, `source_state`, `provenance_note` | Empty `sources` is legal and expected for a fixture and for a practical note; it is the honest state, not a placeholder. The two sourceless states are not interchangeable: `none-fixture-authored` belongs to `fixture`, `none-authored-here` to `practical-note`, and `src/rules.mjs` ties each to its class. |
| `reviewed_at`, `record_version`, `change_history` | Newest history entry first; `supersedes` chains backwards and is `null` on the initial entry. |
| `rights` | Licence and image-rights review state. Images may only be present once `image_rights_review_state` is `cleared`. |
| `safety` | Caveats plus a review state. A fixture may not claim `reviewed`. |

Collection manifests carry the same provenance, version, and rights fields, plus
`title`, `description`, `scope_note`, and `item_ids` (membership by id only).

An optional `sections` array holds editorial groupings inside one collection:
each entry has a stable `section_id`, a `title`, an `intro`, and its own
`item_ids`. A section is a presentation and discovery facet, never a second
membership list — every member is still a full member of the collection and
still an ordinary card in the gallery grid, and the manifest reads correctly
with `sections` ignored entirely. The gallery renders a section as a *curated
lens*: its title, its count, its `intro`, and one affordance that narrows the
single catalogue to that section's records. It never lists the members a second
time, so each record has exactly one card on the page. Membership reaches the
browser as a `data-sections` facet on each card, keyed by `section_id`, and the
affordance is a real link carrying `?section=<section_id>` — so the lens is
shareable, keyboard-operable, and inert rather than broken without scripting. `src/rules.mjs` requires every section member
to be listed in `item_ids`, rejects a duplicate `section_id`, rejects a record
listed twice inside one section, and refuses a record claimed by two sections.
This build declares one section, `quick-air-fryer`, holding the eight practical
notes.

## Sourced records

A `sourced` record derives from identified sources and is held to the opposite
rules from a fixture: it must carry at least one entry in `sources`, must not
use `source_state: none-fixture-authored`, and must not claim
`fixture-original-text` licensing. Each `sources` entry carries `url`, `title`
and `accessed_at`; author or publisher attribution goes in its `note`, since the
entry has no dedicated field for it.

Three honesty distinctions are worth stating, because the schema alone does not
enforce them:

- **Editorial checking is not a food-safety review.** A record checked against
  its source keeps `safety.review_state: not-reviewed`. `reviewed` would claim a
  professional review that has not happened.
- **Sourced is not publication-ready.** `publication_ready` stays `false` until
  a separate factual review.
- **Facts are paraphrased, not reproduced.** `rights.content_license` says so,
  and `license_review_state` stays `not-reviewed` until a rights review.

Where a record states a safe internal temperature, it names the authority in the
same step. Time is not a safety control, and poultry, minced meat, whole cuts
and fish have different thresholds.

## Original practical notes

A `practical-note` is everyday cooking written directly for this repository. It
is neither of the other two classes, and it has its own gate in `src/rules.mjs`:
`sources` must be empty, `source_state` must be `none-authored-here`,
`region.label_basis` must be `editorial-facet` (there is no source to attribute
a region to), `safety.review_state` must be `not-reviewed`, it may not claim
`fixture-original-text` licensing, it may not be `publication_ready`, and its
`record_notice` must name it as a practical note.

Its empty `sources` list is the honest state rather than a gap: the record makes
no claim about any published recipe, so there is nothing to cite. A note that
ever acquires real sources is promoted to `sourced` instead of being annotated
after the fact.

Because such a record cites nobody, a further rule applies to the one case where
that matters. If the method names a cook-to-the-centre temperature in Celsius,
it must also tell the reader to check that figure against the food-safety
authority published where they live. A practical note never attributes a
threshold to an authority it has not cited, and never presents elapsed time or
colour as a doneness test.

## Translation overlays

Base records under `content/items/` and `content/collections/` stay canonical
English and byte-identical. A translation is an additive overlay file:

```
content/locales/ui/<code>.json                    interface dictionary
content/locales/items/<code>/<item_id>.json       record translation
content/locales/collections/<code>/<id>.json      manifest translation
```

An overlay keys its text by the record's own stable identifiers — `item_id` by
filename, `variant_id`, `method` step number, `change_history` version, and
ingredient rows by their canonical English `item` text, since the schema gives
those rows no id of their own. No id, field set, or part of the data contract
moves: a localized record is a drop-in view of the canonical one, and the
machine-readable facets (`tags`, `region.label_basis`, review states, `sources`)
stay canonical rather than being translated.

Overlays are not schema-validated and are not required. A missing file is the
untranslated state; an unfilled field keeps its English original and the page
says so with a visible notice. `name.alt` and `title.alt` legitimately keep
cross-language aliases — "Rice Porridge" alongside 米粥 — which is what lets a
search typed in either language find the record.

Translating a record does not promote it. A fixture stays a fixture in every
locale, and a sourced record stays unreviewed and not publication-ready in every
locale.

Numbers are the part of a translation that can do harm. Quantities, times,
temperatures, sizes and safe internal thresholds must be identical in every
language; `tests/locale.mjs` compares them field by field for the sourced
records rather than trusting a reading.

## Stories

A story is a literary work, not a knowledge record. It claims nothing about the
world, cites nothing because it summarizes nothing, and is published as its
named author's own text. Three things follow from that, and they are the whole
difference between the two contracts.

**It has no sources, and that is the honest state.** `record_class` is
`original-fiction`, `provenance.origin` is `original-work`, and
`provenance.sources` is empty. A work that ever needed a citation would not be
this class of record. "Sourced", "reviewed", "kitchen-tested" and
`publication_ready`-as-safety do not apply; `publication_ready` on a story means
only that its author has released it.

**Its body has exactly one canonical language.** It is never machine-translated,
so there is no English original for a translation overlay to fall back to. A
story and the shelf manifest therefore carry a complete metadata block per
interface locale *inside the record*, under `locales`, and `src/stories.mjs`
fails the build if one is missing or blank. `body_language` marks the text,
`title.canonical` keeps the title the author gave it, and every locale shows
that canonical title beside its own rendering so no reader mistakes a translated
title for the work's name.

**Its text must arrive whole.** `body` is an ordered list of plain blocks — a
`paragraph` carries `text`, a `verse` carries `stanzas`, each a list of lines.
No markup, no Markdown, nothing a renderer has to parse. `body_block_count`
declares the length and is checked against the array on every build, so a
published text cannot lose a paragraph to a careless edit. `emphasis` lists
exact substrings to render as strong, and a phrase that no longer occurs in its
block fails the build rather than silently rendering nothing.

| Field | Notes |
| --- | --- |
| `schema_version`, `story_id`, `shelf_id` | Identity. A file under `content/stories/items/` must be named for its `story_id`. |
| `record_class` | `original-fiction`, the only class a story shelf holds. |
| `publication_ready` | True only for a work its author has released. |
| `title` | `canonical` plus `canonical_language`; must agree with `body_language`. |
| `body`, `body_block_count`, `body_language` | The text, its declared length, and its language. |
| `authorship` | `author.name` — required and non-blank for a released work — and `acknowledgements`. The *role* is prose and lives in each locale's `acknowledgement` string. |
| `provenance` | `origin`, an empty `sources`, and a `note` saying where the work came from. |
| `rights` | Licence, holders, review state, images and their review state. |
| `locales` | One complete block per interface locale: `title`, `abstract`, `genre_note`, `body_language_note`, `publication_note`, `acknowledgement`, `rights_note`. |
| `first_published`, `reviewed_at`, `record_version`, `change_history` | Publication facts and a chained history, as on any record. |

### Story rules (`src/stories.mjs`)

**Referential.** Every `story_ids` entry has a record; every record on disk is
listed in the manifest; `shelf_id` agrees both ways; no duplicate ids; the
version history chains and has no duplicate versions. A file dropped into
`content/stories/items/` is a build failure, not a draft the build may pick up.

**Honesty.** The mirror image of the recipe gates. A story may not carry a
source, may not claim an origin other than `original-work`, must name its
author, must not disagree with itself about the language of its title and body,
must not lose or gain a body block, and must not carry a stale emphasis marker.
A released story's `genre_note` must, *in every locale*, both name the work as
fiction and state what it is not — which is what keeps an invented text from
ever being read as a quoted one.

These are gates, not documentation: a violation fails `npm run check` and
`npm run build`.

### Adding a story

1. Write `content/stories/items/<story_id>.json`, with a complete `locales`
   block for every interface locale in `src/i18n.mjs`.
2. Add `<story_id>` to `content/stories/shelf.json`'s `story_ids`, in editorial
   order.
3. Run `npm run check`.

There is no translation-overlay step, and there should not be one: the body is
published in the language it was written in, and the metadata around it is
written — not translated — for each interface language.

## The validated subset

`src/schema-validate.mjs` interprets exactly these keywords:

`$schema`, `$id`, `$comment`, `title`, `description`, `type`, `const`, `enum`,
`pattern`, `minLength`, `required`, `properties`, `additionalProperties`,
`items`, `minItems`.

Anything outside the subset **throws** rather than being silently ignored. A
schema constraint that quietly does nothing is worse than no constraint, because
it reads like a guarantee. To add one, either extend the validator or express
the rule in `src/rules.mjs`.

## Cross-record rules (`src/rules.mjs`)

**Referential.** Every `item_ids` entry has a file; every file on disk is listed
in the manifest; `collection_id` agrees both ways; no duplicate ids; the version
history chains and has no duplicate versions. Every section member is a member
of the collection, no `section_id` repeats, and no record is claimed twice.

**Honesty.** A `fixture` may not be `publication_ready`, may not carry sources,
must use `source_state: none-fixture-authored` and
`region.label_basis: fixture-illustrative`, may not claim a completed safety
review, and its `record_notice` must name it as a fixture. A `sourced` record
needs at least one identified source URL, may not use either sourceless
`source_state`, and may not claim fixture licensing. A `practical-note` is held
to the gate described under *Original practical notes* above, including the
cook-to-temperature rule. Neither sourceless `source_state` may be borrowed by
the class it does not belong to. No free text or source URL may contain a
placeholder-source marker (`example.com`, `placeholder`, `todo://`, and
similar).

These are gates, not documentation: a violation fails `npm run check` and
`npm run build`.

## Adding a record

1. Write `content/items/<item_id>.json`.
2. Add `<item_id>` to the collection manifest's `item_ids`, in editorial order.
3. Run `npm run check`.

A translation is optional and is added the same way: write
`content/locales/items/<code>/<item_id>.json`. Until it exists, the record
renders in English under an untranslated notice.

Promoting a fixture to `sourced` requires real source URLs, a rights review, and
a new `change_history` entry — the rules refuse the half-step.
