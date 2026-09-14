# Content schema

Records are plain JSON under `content/`. The schemas in `content/schema/` are
ordinary JSON Schema documents, so the records stay portable to any validator.

- `library-item/1.0.0` — `content/schema/library-item.schema.json`
- `library.collection/1.0.0` — `content/schema/library-collection.schema.json`

Schema `$id`s, `schema_version` values, `item_id`s, and `collection_id`s are
stable identifiers. The project's official name is **Library of the Citadel**,
but that naming decision changed only human-readable `title`/`description`
metadata — no identifier moved, so existing records keep validating unchanged.

A file under `content/items/` must be named for its `item_id`.

## Item fields

| Field | Notes |
| --- | --- |
| `schema_version`, `item_id`, `collection_id` | Identity. `item_id` is stable: never reused, never renumbered. |
| `record_class` | `fixture` (authored to demonstrate the contract) or `sourced` (derived from identified sources). |
| `publication_ready` | Must be `false` for a fixture. |
| `record_notice` | Honesty banner rendered on every view of the record. |
| `name`, `region`, `summary`, `tags` | Display and search facets. `region.label_basis` records how much weight the label carries — it is a filter facet, not an attribution claim. `source-attributed` means the cited page names the region itself; `editorial-facet` means this project assigned it for browsing and the source makes no such claim; `fixture-illustrative` is for demonstration records. |
| `variants` | Regional variants held side by side. The framework never nominates one as definitive. |
| `ingredients`, `method`, `yield_note` | `method` steps are numbered `1..n` in order. |
| `sources`, `source_state`, `provenance_note` | Empty `sources` is legal and expected for a fixture; it is the honest state, not a placeholder. |
| `reviewed_at`, `record_version`, `change_history` | Newest history entry first; `supersedes` chains backwards and is `null` on the initial entry. |
| `rights` | Licence and image-rights review state. Images may only be present once `image_rights_review_state` is `cleared`. |
| `safety` | Caveats plus a review state. A fixture may not claim `reviewed`. |

Collection manifests carry the same provenance, version, and rights fields, plus
`title`, `description`, `scope_note`, and `item_ids` (membership by id only).

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
history chains and has no duplicate versions.

**Honesty.** A `fixture` may not be `publication_ready`, may not carry sources,
must use `source_state: none-fixture-authored` and
`region.label_basis: fixture-illustrative`, may not claim a completed safety
review, and its `record_notice` must name it as a fixture. A `sourced` record
needs at least one identified source URL and may not claim fixture licensing.
No free text or source URL may contain a placeholder-source marker
(`example.com`, `placeholder`, `todo://`, and similar).

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
