# Documentation

The project's official name is **Library of the Citadel**, distinct from
Atom-KB's separate Library. Where these documents say "Library" unqualified,
they mean this project's framework layer, never Atom-KB's.

- [architecture.md](architecture.md) — modules, build pipeline, output shape.
- [content-schema.md](content-schema.md) — record fields, the validated JSON
  Schema subset, and the cross-record rules.
- [configuration.md](configuration.md) — configuration keys, environment
  overrides, base paths, and deployment notes.
- [STATUS.md](STATUS.md) — current completed/pending checkpoint and next step.
- [../CLAUDE.md](../CLAUDE.md) — public-safe contribution and resume policy.

Start with the project [README](../README.md) for commands and layout.

Three conventions run through these documents:

1. **Content is portable.** A record under `content/` is readable and usable
   with none of the Library of the Citadel presentation code. Nothing in `src/templates/`
   is required to interpret it.
2. **Honesty is enforced, not just documented.** A fixture cannot quietly
   acquire sources, a completed review, or publication-ready status —
   `src/rules.mjs` fails the build instead.
3. **Language is additive.** English is the default locale and the canonical
   record text; Chinese is an overlay under `content/locales/` and a `zh/` page
   set. No translation moves an id, and an untranslated field falls back to
   English behind a visible notice rather than disappearing.
