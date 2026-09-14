# Project status

Updated: 2026-09-14 (Australia/Canberra)

## Completed

- Independent static framework implemented: hall, World Recipes gallery, three
  generated fixture detail pages, portable JSON records/schemas, search and
  region filtering, and root/subpath static builds.
- Exactly three records remain clearly labelled, unsourced demonstration
  fixtures; none is publication-ready.
- Closure verification passed the existing lightweight project check: 35/35
  tests, including generated root/subpath outputs, links, public-output exclusions,
  and deterministic rebuild behavior.
- Local directory renamed to `library-of-the-citadel/` after prior work stopped.
- Internal run receipts were preserved outside this public project tree.
- Canonical public repository URL:
  <https://github.com/JJYDXFS-Lab/library-of-the-citadel.git>.

- Deployment workflow added for `main` pushes and manual dispatch: Node.js 24,
  project-subpath build, `dist/`-only Pages artifact, and scoped deployment job.
- Public contribution guide is tracked as root `CLAUDE.md`; private run receipts
  remain outside the repository and static build output.

## Previous publication verified

- Repository visibility changed from Private to Public on 2026-09-13.
- GitHub Pages source is **GitHub Actions**, with enforced HTTPS and no custom domain.
- Live site: <https://jjydxfs-lab.github.io/library-of-the-citadel/>.
- Deployed source: `efcf62800ee748742d5545250af8294dc460d1df`.
- [Deployment run 34754500267, attempt 2](https://github.com/JJYDXFS-Lab/library-of-the-citadel/actions/runs/34754500267/attempts/2)
  succeeded after re-running the failed deployment job; the existing build artifact was reused.
- Live hall, gallery, representative Rice Porridge detail, About page, CSS and
  JavaScript returned HTTP 200. Browser navigation and search (`rice`: 1 of 3)
  passed; fixture, unsourced, rights and safety-review labels remained visible.

## Pending

- No custom domain or public Citadel backlink is configured. The disabled
  backlink placeholder remains intentional; do not invent a destination.
- Fixture records require provenance, licensing/rights, safety, and editorial
  review before any promotion to sourced/publication-ready content.

## Bilingual release — locally accepted, publication authorized

The bilingual milestone has passed local acceptance and is approved for release
on `main`. The deployment recorded above is the previous verified publication;
the new push triggers the existing Pages workflow. Its successful deployment
and live content must be verified independently before claiming publication.

- Present locally: English / 中文 navigation links across hall, gallery, detail
  and About pages; English-default and `zh/` routes; guarded preference storage;
  locale-aware HTML; route/query/region/fragment preservation; UI dictionaries
  and all three Chinese fixture overlays with explicit translation fallback.
- Modified source: `src/assets/app.js`, `src/assets/site.css`, `src/build.mjs`,
  `src/templates/pages.mjs`, `tests/check.mjs`.
- New files: `src/i18n.mjs`, `tests/locale.mjs`, and `content/locales/` (two UI
  dictionaries, one Chinese collection overlay, three Chinese item overlays).
  Base record IDs and original fixture records remain unchanged.
- Full `npm run check` after the two assertion corrections: **62 of 62 passed,
  0 failed, none skipped**, rerun independently.
- The two previously faulty assertions in `tests/locale.mjs` were corrected:
  - Translation completeness: the "still carries its English original"
    containment check now applies only where the English original contains
    translatable words. A quantity written only as a numeral, such as the bay
    leaf's `1`, legitimately survives inside the Chinese `1 片`. The field is
    still required to differ from the English original and to be written in
    Chinese, and no other field relaxes.
  - English page set: the check no longer treats the presence of the string
    `米粥` in English HTML as a leak. English records carry Chinese aliases by
    design (`title.alt` 世界食谱, `name.alt` 米粥), which the build displays and
    folds into the search haystack. The test now asserts the displayed heading
    and card titles per locale, asserts that translated prose — description,
    fixture notice, summary — never reaches an English page, and asserts that
    both aliases survive in the haystack so bilingual search keeps working.
- `npm run build`, `npm run build:preview`, and a build for the actual Pages
  subpath `/library-of-the-citadel/` all pass, rerun independently. Static
  acceptance checked 12 HTML pages and 136 local references with no missing
  links/assets, incorrect locale markers, or private-file leakage.
- Local headless Chrome acceptance passed 26 checks, including both language
  page sets, search, region/query/fragment retention, persisted language, no-JS
  links, and mobile overflow. Nine screenshots were captured; representative
  English hall, Chinese gallery and Chinese mobile detail were visually reviewed.
  This is local headless-browser evidence, not a logged-in desktop-profile check.
- Public documentation for the bilingual layer is now written: `README.md`,
  `docs/README.md`, `docs/architecture.md`, `docs/content-schema.md`, and
  `docs/configuration.md`. `CLAUDE.md` is unchanged.
- Release preflight independently reran all **62 tests** and the actual Pages
  subpath build successfully. The accepted source was checked against the saved
  checkpoint, with base records unchanged. No owned development or preview
  process remains running.

## Next step

Publish this approved bilingual release through the existing `main` workflow,
then verify the new deployment and both live language routes. This source
checkpoint records pre-push acceptance, not a premature deployment-success claim.
Do not begin a new content milestone as part of this closure. The deployment
base path is `/library-of-the-citadel/`; default configuration remains neutral.
