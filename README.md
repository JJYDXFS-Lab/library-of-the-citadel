# Library of the Citadel

A static Library framework: a hall, a **World Recipes** gallery with search and a
region filter, one generated page per knowledge record, and a **Stories /
故事集** shelf holding original literary work. No dependencies, no backend, no
build toolchain — Node's standard library and plain HTML/CSS/JS.

The site is bilingual. English is the default and owns the site root; Chinese is
the same page set again under `zh/`, with identical routes and record IDs, so
switching language keeps the page, the search, the region filter, and the
fragment. The switch is a real link and works with scripting disabled.

> **Name.** The official project and display name is exactly **Library of the
> Citadel**. It is a distinct project from **Atom-KB's separate Library**: the
> two hold different content in different stores, and this project neither
> mirrors, syncs, nor supersedes Atom-KB's. Any link between them is a pointer,
> not a source-of-truth relationship.
>
> The local project directory is `library-of-the-citadel/`. The owner-supplied
> canonical repository URL is <https://github.com/JJYDXFS-Lab/library-of-the-citadel.git>.
> Repository visibility is managed on GitHub. The Pages workflow is defined
> in `.github/workflows/pages.yml`; a workflow file alone does not establish a
> successful deployment. See the configuration and status docs for setup.

**Live fixture site:** <https://jjydxfs-lab.github.io/library-of-the-citadel/> —
public repository and GitHub Actions deployment verified on 2026-09-13.

> **Mixed build.** Seventeen records, of three kinds, every one of them translated
> into Chinese and labelled with which kind it is.
>
> - **Six sourced** beginner oven recipes. Each cites the page its quantities,
>   oven temperature and timings come from, with the date that page was read,
>   and cites the food-safety authority behind any temperature threshold it
>   states. The directions are written here in this project's own words; no
>   source text or photograph is reproduced. They have been checked against
>   their sources, but **nothing has been cooked or tested here and none has had
>   a professional food-safety review**.
> - **Eight original practical notes**, grouped as the **Quick Air-Fryer**
>   section of the collection. They were written here for a small air fryer and
>   an ordinary supermarket shop, and they **cite nothing, because they claim
>   nothing that needs a citation** — they are not summarized from anyone's page
>   and they are not demonstration records either. Times and temperatures are
>   Celsius starting points for your own appliance. Where a note names a
>   temperature to cook to, it hands you back to the food-safety authority
>   published where you live, because the record names none of its own. **None
>   of them has been cooked or tested here and none has had a professional
>   food-safety review.**
> - **Three fixtures**, authored to exercise the content contract. They are not
>   researched, sourced, kitchen-tested, or publication-ready, and they make no
>   claim about the history, authenticity, or regional ownership of any dish.
>
> No record is publication-ready. Translating a record does not research, test,
> or review it, and the labels say so in both languages.

> **Stories / 故事集 — three published works.** A second shelf, a second content
> type, and a different contract. A story is not a knowledge record: it makes no
> factual claim, cites nothing because it summarizes nothing, and is published
> as its named author's own text with rights reserved. It is therefore never
> "sourced", never "reviewed", and never kitchen-tested — those words do not
> apply to it.
>
> The shelf holds **three stories**:
>
> - An original fictional and philosophical dialogue written in the manner of a
>   Chan (Zen) *gong'an*. It is **not Buddhist scripture, not a quotation from
>   any historical text or teacher, and it carries no Buddhist authority**; the
>   characters, the exchange and the closing verse are invented.
> - An original **bilingual** dialogue about working with an AI collaborator.
>   Its Chinese and English versions were both written by its authors and are
>   published together as one work; neither is a translation of the other, and
>   it is **not research, not a report, and not evidence** of anything.
> - An original Chinese **fairy tale** about a kindergarten for newly made
>   agents and the human child who visits it. It is **not a report, not a
>   quotation, and not a claim about any real person, school, or system**.
>
> Each body is published as its authors' canonical text in both language views.
> Where the work is a **Chinese original**, the English view gives an English
> title, an English abstract and English metadata, and says plainly that the
> text itself is the Chinese original rather than machine-translating it.

## Requirements

Node.js 18 or newer. Nothing to install; `dependencies` and `devDependencies`
are both empty and stay that way.

## Commands

```sh
npm run check          # node --test tests/*.mjs
npm run build          # -> dist/          served at "/"
npm run build:preview  # -> dist-preview/  served at "/library-preview/"
```

The two builds write to separate output directories, so a root build and a
subpath build can exist side by side. Each run deletes and rewrites only its own
output directory; `src/config.mjs` refuses any `LIBRARY_OUT_DIR` that would
resolve onto the repository itself.

Serve the result with any static file server, or open `dist/index.html` after a
root build. **Nothing here starts a server**, and the deployed output needs none.

## Layout

| Path | What lives there |
| --- | --- |
| `content/items/` | One JSON file per record, named for its `item_id`. |
| `content/collections/` | Collection manifests; membership is by `item_id`. |
| `content/stories/items/` | One JSON file per story, named for its `story_id`. |
| `content/stories/shelf.json` | The story shelf manifest; membership is by `story_id`. |
| `content/schema/` | JSON Schema documents — the source of truth for shape. |
| `content/locales/` | Interface dictionaries and additive record-translation overlays, keyed by stable record IDs. |
| `config/site.config.json` | Deployment configuration; deployment values plus documented environment overrides. |
| `src/` | Config, content loading, validation, rules, templates, build. |
| `src/assets/` | `site.css` and `app.js`, copied verbatim into the output. |
| `tests/` | Node-stdlib checks. |
| `docs/` | Architecture, content schema, and configuration notes. |

## Documentation

- [`docs/architecture.md`](docs/architecture.md) — how a build runs, and why.
- [`docs/content-schema.md`](docs/content-schema.md) — the record contract.
- [`docs/configuration.md`](docs/configuration.md) — base paths and deployment.
- [`docs/STATUS.md`](docs/STATUS.md) — small resumable project checkpoint.
- [`CLAUDE.md`](CLAUDE.md) — public-safe contribution and checkpoint policy.

## What this repository deliberately does not do

The Pages workflow builds and deploys only `dist/` at the project subpath;
repository Pages settings must separately select **GitHub Actions**. No custom
domain, Citadel destination, or scheduler is configured, and no repository name
or host is compiled into `src/`. It fetches nothing at runtime —
no fonts, images, analytics, or third-party scripts. It ships no images, and
records say so in `rights.image_rights_review_state`.
