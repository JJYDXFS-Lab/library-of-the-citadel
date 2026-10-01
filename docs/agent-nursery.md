# Agent Nursery

Agent Nursery is an independent collection, beside World Recipes and the story
shelf rather than inside either. It is a project whose long-term goal is an
institution of the same name; that institution has not been established and is
not operating, and every locale of the landing prose is required to say so.
Its first published artifact is one bilingual handbook.

Nothing about the two existing collections moved when it was added: no record,
manifest, route, or identifier.

## What is on disk

| Path | What it holds |
| --- | --- |
| `content/agent-nursery/collection.json` | The manifest. Membership is by `handbook_id`. |
| `content/agent-nursery/handbooks/` | One JSON record per handbook, named for its `handbook_id`. |
| `content/agent-nursery/sources/<handbook_id>/<locale>.md` | The authors' manuscripts, verbatim. |
| `content/schema/library-nursery-collection.schema.json` | The manifest's shape. |
| `content/schema/library-handbook.schema.json` | The handbook record's shape. |
| `src/markdown.mjs` | The manuscript reader. |
| `src/nursery.mjs` | Loading, the gates, and the per-locale view. |
| `src/templates/nursery.mjs` | The landing page and the handbook reader. |

The text itself lives in Markdown, not in JSON. A recipe is a structured record
and a story is a block list, but a handbook is a long authored manuscript, and
the honest way to hold one is as the file its authors wrote, with the record
wrapped around it rather than transcribed out of it.

## Bilingual projection

Each locale has its own complete manuscript. Neither is generated from the
other: exactly one is declared `manuscript_role: "source"` — for the first
handbook, the Chinese edition — and the other is a translation of it at the same
version. There is no fallback to an English original, so every handbook record
carries a full metadata block per interface locale, and each page says which
edition the reader is looking at.

The two editions are held together by one language-independent spine declared in
`structure.sections`. Page anchors are those declared `section_id`s rather than
slugs derived from headings, so `#chapter-3` means the same place in both page
sets and the language switch keeps a reader's place in a long document. The
authors' own language line, written as links between their manuscript files, is
resolved through `language_links` to the real route for this same reader in the
other language.

The build emits four pages — the landing page and the handbook reader, once per
locale — plus `data/agent-nursery.json`, which is the records with no
presentation applied.

## The gates

`src/nursery.mjs` refuses to publish on any disagreement between a manuscript
and the record that claims it. A failure is a build failure, not a warning.

- **Bytes.** Every build recomputes SHA-256 over each manuscript and compares it
  with the declared `sha256` and `bytes`. An edit to an author's text fails the
  build until someone writes down that it happened. The preface carries a second
  digest of its own passage, so it cannot be re-drafted inside an otherwise
  valid edit.
- **Completeness.** `src/markdown.mjs` supports only the constructs the
  manuscripts use — three heading levels, paragraphs, quotations, `**strong**`,
  inline links — and fails on any line it cannot account for, naming the line
  number. It never re-wraps an author's lines.
- **Structure.** The headings a manuscript actually has must be exactly the
  declared spine, in order, at the declared levels, with one level-1 title above
  it. The declared `chapter_count`, `exercise_count` and `appendix_count` must
  match the sections listed, and a spine carries exactly one preface and exactly
  one revision-notes section.
- **Closing line.** Each manuscript must end on the `copyright_line` the record
  declares, and that line must name every rights holder. It is the one place
  inside the text where holders are linked.
- **Membership.** An id in the manifest with no record on disk, and a record on
  disk the manifest does not list, are both errors. Neither becomes an empty
  page or a quiet draft.
- **Status.** Every locale of the landing prose must state where the institution
  the project is working toward currently stands.

## Updating a handbook

A handbook is a living document, and a revision is a recorded act:

1. Edit the manuscript. Edit every locale's manuscript that the change affects —
   the editions correspond at the same version.
2. Recompute and update `sha256`, `bytes`, and, if the preface changed,
   `preface_sha256`. Until they match, the build fails.
3. If sections were added, removed, or reordered, update `structure` in the same
   commit: the spine, the three counts, and any `section_id` an anchor depends
   on. Reusing an id for a different section breaks links that already exist.
4. Raise `record_version`, add a `change_history` entry at the front saying what
   changed and why, and point its `supersedes` at the version before it. The
   newest entry must be first and the oldest must have `supersedes: null`.
5. Update `edition` and `edition_date` for a new edition, and the per-locale
   `edition_note` that states it.
6. Adding or withdrawing a handbook is also a manifest change: update
   `handbook_ids` and the collection's own `record_version` and
   `change_history`.

`tests/nursery.mjs` pins the published digests, the approved preface, the spine,
the four routes, and the rendered text against the manuscripts, so a revision
that is only half recorded fails there too.
