# Project status

Updated: 2026-09-13 (Australia/Canberra)

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

## Publication verified

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

## Next step

Choose and review the first sourced content milestone. The deployment base path
is `/library-of-the-citadel/`; the default source configuration remains deployment-neutral.
