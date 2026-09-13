#!/usr/bin/env node
// Static build. Reads content/ + config/, writes a self-contained directory of
// HTML and assets with no runtime server dependency.
//
//   node src/build.mjs
//   LIBRARY_BASE_PATH=/library-preview/ node src/build.mjs
//   LIBRARY_OUT_DIR=dist-preview node src/build.mjs

import { mkdirSync, writeFileSync, rmSync, cpSync, statSync, readdirSync } from 'node:fs';
import path from 'node:path';

import { loadConfig, repoRoot } from './config.mjs';
import { loadContentOrThrow, regionsOf } from './content.mjs';
import { hallPage, galleryPage, detailPage, aboutPage } from './templates/pages.mjs';

export function build(env = process.env) {
  const cfg = loadConfig(env);
  const { collections, items } = loadContentOrThrow();

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

  emit('.', hallPage(cfg, { collection, items: ordered }));
  emit('recipes', galleryPage(cfg, { collection, items: ordered, regions: regionsOf(ordered) }));
  emit('about', aboutPage(cfg, { collection, items: ordered }));
  ordered.forEach((item, i) => {
    emit(path.join('recipes', item.item_id), detailPage(cfg, {
      collection,
      item,
      neighbours: { prev: ordered[i - 1] ?? null, next: ordered[i + 1] ?? null },
    }));
  });

  cpSync(path.join(repoRoot, 'src', 'assets'), path.join(cfg.outDir, 'assets'), { recursive: true });
  for (const f of readdirSync(path.join(cfg.outDir, 'assets'))) written.push(path.join('assets', f));

  // GitHub Pages would otherwise hand the output to Jekyll, which drops
  // underscore-prefixed paths. Cheap insurance, and harmless elsewhere.
  writeFileSync(path.join(cfg.outDir, '.nojekyll'), '', 'utf8');
  written.push('.nojekyll');

  // A machine-readable copy of the content, so the records stay consumable by a
  // Citadel index adapter without scraping the HTML. Presentation-free.
  mkdirSync(path.join(cfg.outDir, 'data'), { recursive: true });
  writeFileSync(
    path.join(cfg.outDir, 'data', 'world-recipes.json'),
    `${JSON.stringify({ collection, items: ordered }, null, 2)}\n`,
    'utf8',
  );
  written.push(path.join('data', 'world-recipes.json'));

  const bytes = written.reduce((sum, rel) => sum + statSync(path.join(cfg.outDir, rel)).size, 0);
  return { cfg, outDir: cfg.outDir, written, bytes, itemCount: ordered.length };
}

if (import.meta.url === `file://${process.argv[1]}`) {
  try {
    const r = build();
    const kb = (r.bytes / 1024).toFixed(1);
    console.log(`Built ${r.written.length} files (${kb} KB) for base path "${r.cfg.basePath}"`);
    console.log(`  records: ${r.itemCount}`);
    console.log(`  output:  ${path.relative(repoRoot, r.outDir)}/`);
  } catch (err) {
    console.error(`Build failed: ${err.message}`);
    process.exit(1);
  }
}
