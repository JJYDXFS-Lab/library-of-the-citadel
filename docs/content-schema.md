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
| `name`, `region`, `summary`, `tags` | Display and search facets. `region.label_basis` records how much weight the label carries — it is a filter facet, not an attribution claim. |
| `variants` | Regional variants held side by side. The framework never nominates one as definitive. |
| `ingredients`, `method`, `yield_note` | `method` steps are numbered `1..n` in order. |
| `sources`, `source_state`, `provenance_note` | Empty `sources` is legal and expected for a fixture; it is the honest state, not a placeholder. |
| `reviewed_at`, `record_version`, `change_history` | Newest history entry first; `supersedes` chains backwards and is `null` on the initial entry. |
| `rights` | Licence and image-rights review state. Images may only be present once `image_rights_review_state` is `cleared`. |
| `safety` | Caveats plus a review state. A fixture may not claim `reviewed`. |

Collection manifests carry the same provenance, version, and rights fields, plus
`title`, `description`, `scope_note`, and `item_ids` (membership by id only).

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

Promoting a fixture to `sourced` requires real source URLs, a rights review, and
a new `change_history` entry — the rules refuse the half-step.
