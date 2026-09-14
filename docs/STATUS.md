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
- Six sourced oven recipes are now prepared; see the milestone section below.
  The first two are already published; the other four are complete locally and
  awaiting release.

## Local footer milestone — written, not verified, not published

Every page in both locales now ends with a shared copyright line, `© 2026 Atom
& Claude.`, composed from the new `copyright.year` and `copyright.holders` keys
in `config/site.config.json`, plus a localized rights note stating that records
citing sources summarize cooking facts in this project's own words, reproduce no
source text or image, and leave third-party rights with their owners. The
copyright line is identical in every locale because it is a name; the note is
prose and is translated. Changed: `config/site.config.json`, `src/config.mjs`,
`src/templates/pages.mjs`, both UI dictionaries, `tests/locale.mjs`, and
`docs/configuration.md`. No stylesheet change; the existing colophon styling
covers both lines.

`npm run check` was **not run** — command execution is unavailable in this
environment, so the new test and the build output are unverified here and must
be validated independently before this is relied on.

## Sourced oven recipes — six prepared, two already published

Six sourced beginner oven recipes are now prepared, in English with full Chinese
translations, alongside the three existing fixtures, which are unchanged. The
collection is mixed — nine records — and its manifest, notice and scope note say
so.

- The first two were published earlier: a lamb kofta meatball traybake and a
  lamb chop and potato bake.
- Four more are now complete and integrated after them: a chicken thigh
  traybake, a salmon and roasted vegetable traybake, a halloumi, aubergine and
  chickpea traybake, and a roasted root vegetable traybake. Each is one tray or
  dish with no pan-searing, no carving and no judged degree of doneness.
- None of the six sources states a resting time. Each record says so rather than
  inventing a duration.
- Each record names the page its quantities, oven temperature and timings come
  from, the author or publisher, and the access date 2026-09-14. Oven
  temperatures and fan/conventional modes are reproduced exactly as the source
  states them; no temperature conversion was invented.
- Safe internal temperatures are attributed to Health Canada, and the
  whole-cut/minced/poultry distinction to the UK Food Standards Agency. Poultry,
  minced lamb, an intact lamb cut and fish are treated as the different cases
  they are: 74°C for chicken pieces, 71°C for minced lamb, 63°C medium-rare or
  71°C medium for a lamb chop, and 70°C for fish. The two vegetarian records
  state that no internal-temperature threshold applies and give a texture
  endpoint instead.
- Every record is `publication_ready: false`, `safety.review_state:
  not-reviewed`, and `license_review_state: not-reviewed`. Editorial checking
  against a source is not a professional food-safety review, and nothing here
  has been cooked or tested.
- Supporting changes: `editorial-facet` added to `region.label_basis` for
  labels this project assigns rather than takes from a source; the record-class
  mark, honesty banner tag and About page now distinguish sourced from fixture
  in both locales; the detail template omits the variants block when a record
  has none.
- Tests were updated and extended: nine-record counts, separate fixture and
  sourced gates, source provenance, per-record class marking, a field-by-field
  EN/ZH numeric parity check, a route check that the emitted detail pages are
  exactly the manifest's records once per locale, and a content-tree check that
  `content/items/` and the Chinese overlay directory hold exactly those records
  and nothing waiting to be picked up.
- Verified locally on 2026-09-14: `npm run check` **70 of 70 passed, 0 failed,
  none skipped**; `npm run build`, `npm run build:preview` and a build at the
  deployment base path each emitted **29 files, 9 records, locales en and zh**.
  Generated output stays untracked. Live publication is still to be verified
  independently after any deployment.

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

### Footer local acceptance

Independent local validation of the footer milestone passed all **63 tests**,
with no failures or skips, plus root, preview-subpath and project-subpath builds.
All 12 generated HTML routes contain the identical copyright line and localized
rights note. Local headless Chrome passed 40 checks, including seven representative
English/Chinese routes, language switching, search and mobile overflow. This is
local validation, not publication or logged-in desktop-profile evidence.
The six sourced oven recipes remain unstarted; all three fixtures are unchanged.
