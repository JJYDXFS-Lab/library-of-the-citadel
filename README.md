# Library of the Citadel

A static Library framework: a hall, a **World Recipes** gallery with search and a
region filter, and one generated page per knowledge record. No dependencies, no
backend, no build toolchain — Node's standard library and plain HTML/CSS/JS.

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

> **Fixture build.** The three records in this repository were authored to
> exercise the content contract and the presentation framework. They are not
> researched, sourced, kitchen-tested, or publication-ready, and they make no
> claim about the history, authenticity, or regional ownership of any dish.

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
| `content/schema/` | JSON Schema documents — the source of truth for shape. |
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
