#!/usr/bin/env node
// Static build. Reads content/ + config/, writes a self-contained directory of
// HTML and assets with no runtime server dependency.
//
// One full page set is emitted per locale: the default locale at the output
// root, every other locale under its own route prefix, same slugs and same
// record IDs throughout.
//
//   node src/build.mjs
//   LIBRARY_BASE_PATH=/library-preview/ node src/build.mjs
//   LIBRARY_OUT_DIR=dist-preview node src/build.mjs

import { mkdirSync, writeFileSync, rmSync, cpSync, statSync, readdirSync } from 'node:fs';
import path from 'node:path';

import { loadConfig, repoRoot } from './config.mjs';
import { loadContentOrThrow } from './content.mjs';
import { loadStoriesOrThrow, storyView, storyRoute, STORIES_ROUTE } from './stories.mjs';
import { LOCALES, DEFAULT_LOCALE, loadDictionaries, makeLocale, localizeView, localizedRegions } from './i18n.mjs';
import { hallPage, galleryPage, detailPage, aboutPage, withShelfTitles } from './templates/pages.mjs';
import { storiesShelfPage, storyPage } from './templates/stories.mjs';

export function build(env = process.env) {
  const cfg = loadConfig(env);
  const { collections, items } = loadContentOrThrow();
  const { shelf, stories } = loadStoriesOrThrow();
  // Fails closed: a missing or empty interface string stops the build here
  // rather than reaching a page as a raw dotted key.
  const dicts = loadDictionaries();

  const collection = collections.find((c) => c.collection_id === 'world-recipes');
  if (!collection) throw new Error('No "world-recipes" collection manifest found under content/collections/.');

  // Manifest order is editorial order; it drives the gallery and prev/next.
  const ordered = collection.item_ids.map((id) => items.find((i) => i.item_id === id));

  rmSync(cfg.outDir, { recursive: true, force: true });
  const written = [];
  const emit = (relDir, html) => {
    const dir = path.join(cfg.outDir, relDir);
    mkdirSync(dir, { recursive: true });
    const file = path.join(dir, 'index.html');
    writeFileSync(file, `${html}\n`, 'utf8');
    written.push(path.relative(cfg.outDir, file));
  };

  mkdirSync(path.join(cfg.outDir, 'data'), { recursive: true });

  for (const loc of LOCALES) {
    const base = makeLocale(cfg, loc.code, dicts);
    const view = localizeView(loc.code, { collection, items: ordered });
    // The story shelf is a second content type, not a second collection: its
    // records carry their own per-locale metadata, so a view is a selection
    // rather than an overlay merge.
    const shelfView = storyView(loc.code, { shelf, stories });
    const L = withShelfTitles(base, { collection: view.collection.record, stories: shelfView });
    // The locale's route prefix is a directory under the output root; the
    // default locale has none and therefore owns the root itself.
    const at = (rel) => path.join(loc.prefix === '' ? '.' : loc.prefix, rel);

    emit(at('.'), hallPage(cfg, L, view, { stories: shelfView }));
    emit(at('recipes'), galleryPage(cfg, L, view, { regions: localizedRegions(view.entries) }));
    emit(at('about'), aboutPage(cfg, L, view, { stories: shelfView }));
    view.entries.forEach((entry, i) => {
      emit(at(path.join('recipes', entry.record.item_id)), detailPage(cfg, L, view, {
        entry,
        neighbours: {
          prev: view.entries[i - 1]?.record ?? null,
          next: view.entries[i + 1]?.record ?? null,
        },
        // Where this record stands on the shelf, in manifest order — the same
        // order prev/next walks, so the two agree by construction.
        position: { index: i + 1, total: view.entries.length },
      }));
    });

    emit(at(STORIES_ROUTE), storiesShelfPage(cfg, L, shelfView));
    for (const entry of shelfView.stories) {
      emit(at(storyRoute(entry.record)), storyPage(cfg, L, shelfView, { entry }));
    }

    // A machine-readable copy of the content, so the records stay consumable by
    // a Citadel index adapter without scraping the HTML. Presentation-free. The
    // default locale keeps the canonical filename and the canonical English
    // text; each other locale gets a sibling view with identical IDs.
    const dataFile = loc.code === DEFAULT_LOCALE ? 'world-recipes.json' : `world-recipes.${loc.code}.json`;
    writeFileSync(
      path.join(cfg.outDir, 'data', dataFile),
      `${JSON.stringify({
        locale: loc.code,
        collection: view.collection.record,
        items: view.entries.map((e) => e.record),
        translation_state: Object.fromEntries(view.entries.map((e) => [e.record.item_id, e.state])),
      }, null, 2)}\n`,
      'utf8',
    );
    written.push(path.join('data', dataFile));
  }

  // The story shelf exports once, not once per locale: a story record already
  // carries its own metadata for every locale, and its body is the same
  // canonical text in all of them. One file is therefore the whole shelf, and
  // splitting it per locale would only duplicate the text.
  writeFileSync(
    path.join(cfg.outDir, 'data', 'stories.json'),
    `${JSON.stringify({ shelf, stories: shelf.story_ids.map((id) => stories.find((s) => s.story_id === id)) }, null, 2)}\n`,
    'utf8',
  );
  written.push(path.join('data', 'stories.json'));

  cpSync(path.join(repoRoot, 'src', 'assets'), path.join(cfg.outDir, 'assets'), { recursive: true });
  for (const f of readdirSync(path.join(cfg.outDir, 'assets'))) written.push(path.join('assets', f));

  // GitHub Pages would otherwise hand the output to Jekyll, which drops
  // underscore-prefixed paths. Cheap insurance, and harmless elsewhere.
  writeFileSync(path.join(cfg.outDir, '.nojekyll'), '', 'utf8');
  written.push('.nojekyll');

  const bytes = written.reduce((sum, rel) => sum + statSync(path.join(cfg.outDir, rel)).size, 0);
  return {
    cfg,
    outDir: cfg.outDir,
    written,
    bytes,
    itemCount: ordered.length,
    storyCount: stories.length,
    locales: LOCALES.map((l) => l.code),
  };
}

if (import.meta.url === `file://${process.argv[1]}`) {
  try {
    const r = build();
    const kb = (r.bytes / 1024).toFixed(1);
    console.log(`Built ${r.written.length} files (${kb} KB) for base path "${r.cfg.basePath}"`);
    console.log(`  records: ${r.itemCount}`);
    console.log(`  stories: ${r.storyCount}`);
    console.log(`  locales: ${r.locales.join(', ')}`);
    console.log(`  output:  ${path.relative(repoRoot, r.outDir)}/`);
  } catch (err) {
    console.error(`Build failed: ${err.message}`);
    process.exit(1);
  }
}
