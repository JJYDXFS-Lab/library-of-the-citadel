# Public contribution guide

**Library of the Citadel** is a dependency-free static Library framework. It
builds a hall, the searchable and region-filterable **World Recipes** gallery,
and one page per portable JSON knowledge record. The repository is public, and
this guide is public project documentation rather than private operating notes.

## Repository map

- `content/items/` and `content/collections/` contain records and manifests.
- `content/schema/` defines the portable JSON contracts.
- `config/site.config.json` holds deployment-neutral site settings.
- `src/` contains validation, rules, templates, assets, and the static builder.
- `tests/` contains Node standard-library tests.
- `docs/README.md` indexes architecture, schema, configuration, and status docs.
- `docs/STATUS.md` is the factual milestone checkpoint for resuming work.

## Commands and validation

The supported runtime is Node.js 18 or newer. The project has no dependencies,
so no install step is required.

```sh
npm run check          # node --test tests/*.mjs
npm run build          # writes dist/ for serving at /
npm run build:preview  # writes dist-preview/ for /library-preview/
```

Run the smallest relevant check. Documentation-only changes normally require
`npm run check` plus direct inspection of changed links and generated-output
boundaries. Implementation or content changes require the relevant full check;
run a build when output behavior is affected. Report exactly what ran and its
result. A smoke check, skipped check, or partial check must never be described
as a full passing test suite.

## Public repository and history boundary

Treat every tracked file, branch, review artifact, and Git commit as permanently
public-readable, including deleted material retained in history.

- Never add credentials, tokens, personal account data, private chat or memory,
  non-public notes, local absolute paths, internal infrastructure details,
  operational logs, agent transcripts, or private run receipts.
- Keep generated output and execution artifacts out of source history. Static
  builds copy only explicit site assets and generated content into `dist*`; a
  source document being tracked does not mean it belongs in deployed output.
- Before committing, inspect both the unstaged and staged diff and confirm that
  unrelated local files remain untouched.

## Content, provenance, and licensing

- Add only material whose provenance and licence permit public redistribution.
  Record source, rights, and review states truthfully. Do not copy protected
  full text or media without permission.
- Keep fixtures explicitly labelled as illustrative. A fixture is not
  researched, tested, authentic, authoritative, safety-reviewed, or
  publication-ready unless evidence and review establish those claims.
- Preserve stable IDs and schema compatibility. Follow `docs/content-schema.md`
  when adding or promoting records, and let the repository's honesty rules fail
  closed rather than weakening them to admit incomplete content.
- Keep code dependency-free unless a deliberate project decision changes that
  constraint. Prefer plain Node.js and accessible, progressively enhanced HTML,
  CSS, and JavaScript consistent with `docs/architecture.md`.

## Milestones, checkpoints, and resume

Work in bounded milestones. Update `docs/STATUS.md` when a milestone changes the
factual public state, before pausing an incomplete multi-step change, or when a
context/quota warning makes continuation unreliable. Do not claim an exact
remaining quota if the tool does not expose one.

On resume, inspect the working tree, the current files, `docs/STATUS.md`, and
the smallest relevant validation result. Do not infer completion from a prior
chat, summary, or polished checkpoint alone. Commit messages and status notes
must distinguish completed work from pending, unverified, or externally
configured work.
