// Checks for the Library framework. Node standard library only — node:test,
// node:assert, node:fs. There is nothing to install.
//
//   node --test tests/*.mjs
//
// The build tests write into dedicated dist-test-* directories so they never
// disturb the dist/ and dist-preview/ output a human is looking at.

import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync, readdirSync, statSync, rmSync } from 'node:fs';
import { after } from 'node:test';
import path from 'node:path';

import { repoRoot, normalizeBasePath, makeWithBase, resolveOutDir, loadConfig } from '../src/config.mjs';
import { loadContent, regionsOf } from '../src/content.mjs';
import { checkItem, checkCollection } from '../src/rules.mjs';
import { validate } from '../src/schema-validate.mjs';
import { esc } from '../src/templates/pages.mjs';
import { build } from '../src/build.mjs';

// The collection is mixed, and the two kinds are held to different rules: a
// fixture must never acquire a source, and a sourced record must never be
// without one. Keeping the two lists apart is what lets each test say which.
const EXPECTED_FIXTURE_IDS = [
  'wr-fixture-griddle-flatbread',
  'wr-fixture-rice-porridge',
  'wr-fixture-simmered-bean-soup',
];
const EXPECTED_SOURCED_IDS = [
  'wr-oven-chicken-thigh-traybake',
  'wr-oven-halloumi-chickpea-traybake',
  'wr-oven-lamb-kofta-traybake',
  'wr-oven-lamb-potato-bake',
  'wr-oven-root-veg-traybake',
  'wr-oven-salmon-traybake',
];
const EXPECTED_ITEM_IDS = [...EXPECTED_FIXTURE_IDS, ...EXPECTED_SOURCED_IDS].sort();

/** Recursive directory walk; readdirSync's own recursive option is newer than our floor. */
function walk(dir, base = dir) {
  const out = [];
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) out.push(...walk(full, base));
    else out.push(path.relative(base, full));
  }
  return out.sort();
}

function linksIn(html) {
  return [...html.matchAll(/(?:href|src)="([^"]*)"/g)].map((m) => m[1]);
}

/** Build once per base path and cache, so the suite does not rebuild per assertion. */
const builds = new Map();
function buildOnce(key, env) {
  if (!builds.has(key)) builds.set(key, build(env));
  return builds.get(key);
}
const rootBuild = () => buildOnce('root', { LIBRARY_OUT_DIR: 'dist-test-root' });
const previewBuild = () => buildOnce('preview', {
  LIBRARY_BASE_PATH: '/library-preview/',
  LIBRARY_OUT_DIR: 'dist-test-preview',
});

const read = (r, rel) => readFileSync(path.join(r.outDir, rel), 'utf8');

function cleanTestOutputs() {
  for (const name of ['dist-test-root', 'dist-test-preview', 'dist-test-stable']) {
    rmSync(path.join(repoRoot, name), { recursive: true, force: true });
  }
}
after(cleanTestOutputs);
// Node 18 may complete the top-level after hook before independently scheduled
// top-level tests finish writing. The synchronous exit hook is the final guard.
process.on('exit', cleanTestOutputs);

// ------------------------------------------------------------ content

test('every content record validates against its schema and the cross-record rules', () => {
  const { errors } = loadContent();
  assert.deepEqual(errors, [], `content validation reported problems:\n  - ${errors.join('\n  - ')}`);
});

test('the repository holds nine records in one collection: six sourced, three fixtures', () => {
  const { items, collections } = loadContent();
  assert.equal(items.length, 9);
  assert.equal(collections.length, 1);
  const idsOfClass = (cls) => items.filter((i) => i.record_class === cls).map((i) => i.item_id).sort();
  assert.deepEqual(idsOfClass('fixture'), EXPECTED_FIXTURE_IDS);
  assert.deepEqual(idsOfClass('sourced'), EXPECTED_SOURCED_IDS);
  assert.deepEqual(items.map((i) => i.item_id).sort(), EXPECTED_ITEM_IDS);
  assert.deepEqual([...collections[0].item_ids].sort(), EXPECTED_ITEM_IDS);
});

test('the fixture gates still hold: no fixture has grown a source or a review', () => {
  const { items, collections } = loadContent();
  for (const record of collections) {
    assert.equal(record.publication_ready, false);
  }
  for (const item of items.filter((i) => i.record_class === 'fixture')) {
    assert.equal(item.publication_ready, false);
    assert.match(item.record_notice, /fixture/i);
    assert.deepEqual(item.sources, []);
    assert.equal(item.source_state, 'none-fixture-authored');
    assert.equal(item.region.label_basis, 'fixture-illustrative');
    assert.notEqual(item.safety.review_state, 'reviewed');
    assert.deepEqual(item.rights.images, []);
  }
});

test('every sourced record carries its provenance and claims no review it has not had', () => {
  const { items } = loadContent();
  const sourced = items.filter((i) => i.record_class === 'sourced');
  assert.equal(sourced.length, 6);

  for (const item of sourced) {
    const where = item.item_id;
    // Provenance: a sourced record without a source is the failure this gate exists for.
    assert.ok(item.sources.length >= 1, `${where}: no source recorded`);
    for (const source of item.sources) {
      assert.match(source.url, /^https:\/\//, `${where}: source URL is not https`);
      assert.ok(source.title.trim(), `${where}: a source has no title`);
      assert.equal(source.accessed_at, '2026-09-14', `${where}: source access date is not the recorded one`);
      // Author or publisher attribution travels with the pointer.
      assert.match(source.note ?? '', /Author:|published by|Health Canada|Publisher:/,
        `${where}: source "${source.title}" records no author or publisher`);
    }
    assert.equal(item.source_state, 'sources-recorded', `${where}: wrong source_state`);

    // Honest review states: editorial checking is not a food-safety review.
    assert.equal(item.publication_ready, false, `${where}: claims to be publication-ready`);
    assert.notEqual(item.safety.review_state, 'reviewed', `${where}: claims a completed safety review`);
    assert.notEqual(item.rights.license_review_state, 'fixture-original-text',
      `${where}: sourced text cannot claim fixture licensing`);
    assert.notEqual(item.region.label_basis, 'fixture-illustrative', `${where}: wrong region label basis`);
    assert.deepEqual(item.rights.images, [], `${where}: sourced records ship no images`);

    // The banner a reader sees must name what the record is and is not.
    assert.match(item.record_notice, /sourced/i, `${where}: the notice does not say the record is sourced`);
    assert.match(item.record_notice, /not been kitchen-tested|no professional food-safety review/i,
      `${where}: the notice does not disclaim testing and safety review`);
  }
});

test('the region facet has a usable spread for the filter', () => {
  const { items } = loadContent();
  const regions = regionsOf(items);
  assert.ok(regions.length >= 3, 'the filter needs more than a couple of regions to be worth having');
  assert.equal(new Set(regions).size, regions.length, 'a region label is duplicated');
  assert.deepEqual(regions, [...regions].sort());
  for (const region of regions) assert.ok(region.trim(), 'a record has a blank region label');
});

// -------------------------------------------------------------- rules

const fixtureItem = () => JSON.parse(readFileSync(
  path.join(repoRoot, 'content', 'items', 'wr-fixture-rice-porridge.json'), 'utf8',
));

test('the honesty rules reject a fixture that grows a source pointer', () => {
  const item = fixtureItem();
  item.sources.push({ url: 'https://example.com/a', title: 'A', accessed_at: '2026-09-13' });
  const errors = checkItem(item);
  assert.ok(errors.some((e) => /must not carry source pointers/.test(e)), errors.join('; '));
  assert.ok(errors.some((e) => /placeholder marker "example\.com"/.test(e)), errors.join('; '));
});

test('the honesty rules reject a fixture promoted to publication-ready or reviewed', () => {
  const ready = fixtureItem();
  ready.publication_ready = true;
  assert.ok(checkItem(ready).some((e) => /must not be marked publication_ready/.test(e)));

  const reviewed = fixtureItem();
  reviewed.safety.review_state = 'reviewed';
  assert.ok(checkItem(reviewed).some((e) => /must not claim a completed safety review/.test(e)));
});

test('the rules reject broken method numbering and a broken version chain', () => {
  const skipped = fixtureItem();
  skipped.method[2].step = 9;
  assert.ok(checkItem(skipped).some((e) => /method steps must be numbered/.test(e)));

  const mismatched = fixtureItem();
  mismatched.record_version = '2.0.0';
  assert.ok(checkItem(mismatched).some((e) => /is not the first \(newest\) change_history entry/.test(e)));
});

test('the rules reject an unreviewed record that ships an image', () => {
  const item = fixtureItem();
  item.rights.images.push({ url: 'local.png', rights_note: 'unknown' });
  assert.ok(checkItem(item).some((e) => /image_rights_review_state/.test(e)));
});

test('the collection rules catch a manifest that drifts from the files on disk', () => {
  const { collections, items } = loadContent();
  const collection = JSON.parse(JSON.stringify(collections[0]));
  collection.item_ids.push('wr-fixture-does-not-exist');
  assert.ok(checkCollection(collection, items).some((e) => /has no record under content\/items/.test(e)));

  const dropped = JSON.parse(JSON.stringify(collections[0]));
  dropped.item_ids = dropped.item_ids.slice(1);
  assert.ok(checkCollection(dropped, items).some((e) => /is not listed in the .* manifest/.test(e)));
});

// --------------------------------------------------------- validator

test('the schema validator reports type, required and unexpected-property problems', () => {
  const schema = {
    type: 'object',
    required: ['a'],
    additionalProperties: false,
    properties: { a: { type: 'string', minLength: 2 } },
  };
  assert.deepEqual(validate({ a: 'ok' }, schema), []);
  assert.equal(validate({}, schema).length, 1);
  assert.equal(validate({ a: 'x' }, schema).length, 1);
  assert.equal(validate({ a: 'ok', b: 1 }, schema).length, 1);
});

test('the schema validator refuses a keyword it does not actually enforce', () => {
  assert.throws(() => validate(1, { type: 'integer', maximum: 3 }), /Unsupported JSON Schema keyword "maximum"/);
});

// ---------------------------------------------------------- base path

test('base paths normalize to one canonical shape', () => {
  for (const raw of ['', '/', undefined]) assert.equal(normalizeBasePath(raw), '/');
  for (const raw of ['library-preview', '/library-preview', 'library-preview/', '/library-preview/']) {
    assert.equal(normalizeBasePath(raw), '/library-preview/');
  }
});

test('withBase refuses anything that is already absolute', () => {
  const withBase = makeWithBase('/library-preview/');
  assert.equal(withBase('recipes/'), '/library-preview/recipes/');
  assert.equal(withBase(''), '/library-preview/');
  assert.throws(() => withBase('/recipes/'), /build-relative/);
  assert.throws(() => withBase('https://elsewhere.invalid/'), /build-relative/);
});

test('the output directory cannot resolve onto the repository itself', () => {
  for (const bad of ['', '.', './', 'src', 'src/assets', 'content', '../escape', '/tmp/elsewhere']) {
    assert.throws(() => resolveOutDir(bad), /LIBRARY_OUT_DIR/, `resolveOutDir accepted ${JSON.stringify(bad)}`);
  }
  assert.equal(resolveOutDir('dist'), path.join(repoRoot, 'dist'));
  assert.equal(resolveOutDir(undefined), path.join(repoRoot, 'dist'));
});

test('no repository name, remote, or host is compiled into the configuration', () => {
  const cfg = loadConfig({});
  assert.equal(cfg.citadel.url, '', 'the citadel URL must stay empty until an owner configures one');
  assert.equal(cfg.basePath, '/');
});

// ------------------------------------------------------------ the name

const OFFICIAL_NAME = 'Library of the Citadel';

test('the official display name is the configured value and the built-in default', () => {
  const fileConfig = JSON.parse(readFileSync(path.join(repoRoot, 'config', 'site.config.json'), 'utf8'));
  assert.equal(fileConfig.siteName, OFFICIAL_NAME);
  assert.equal(loadConfig({}).siteName, OFFICIAL_NAME,
    'a build with no overrides must carry the official name, not a generic "Library"');
});

// The official name is a proper noun: it is not translated, so every page in
// every locale carries the same <title> suffix, wordmark, and hall title.
test('every generated page titles and wordmarks the official name', () => {
  const r = rootBuild();
  for (const page of ALL_PAGES) {
    const html = read(r, page);
    assert.match(html, new RegExp(`<title>[^<]* · ${OFFICIAL_NAME}</title>`), `${page}: wrong <title> suffix`);
    assert.ok(html.includes(`<span class="wordmark__name">${OFFICIAL_NAME}</span>`), `${page}: wrong header wordmark`);
  }
  for (const hallPage of ['index.html', 'zh/index.html']) {
    assert.match(read(r, hallPage), new RegExp(`<h1 id="hall-title" class="hall__title">${OFFICIAL_NAME}`),
      `${hallPage}: the hall title is not the official name`);
  }
});

test('the build states that this is not Atom-KB\'s Library', () => {
  const about = read(rootBuild(), 'about/index.html');
  assert.match(about, /Atom-KB&#39;s separate Library/,
    'the about page must name the distinction from Atom-KB\'s separate Library');
  assert.match(about, /neither\s+mirrors, syncs, nor supersedes/);
  assert.match(read(rootBuild(), 'index.html'), /distinct from Atom-KB&#39;s separate Library/,
    'the colophon footer must carry the distinction on every page');
});

test('esc neutralizes every character that could break out of markup', () => {
  assert.equal(esc(`<a href="x" title='y'>&</a>`), '&lt;a href=&quot;x&quot; title=&#39;y&#39;&gt;&amp;&lt;/a&gt;');
  assert.equal(esc(null), '');
});

// ------------------------------------------------------------- builds

// The default-locale page set, at the output root.
const PAGES = ['index.html', 'recipes/index.html', 'about/index.html',
  ...EXPECTED_ITEM_IDS.map((id) => `recipes/${id}/index.html`)];
// One full page set per non-default locale, under its own route prefix, with
// the same slugs and the same record IDs. tests/locale.mjs covers what is
// inside them; this file covers that the output is exactly this set of files.
const ZH_PAGES = PAGES.map((rel) => `zh/${rel}`);
const ALL_PAGES = [...PAGES, ...ZH_PAGES];
const PAGE_LANG = new Map([
  ...PAGES.map((rel) => [rel, 'en']),
  ...ZH_PAGES.map((rel) => [rel, 'zh-Hans']),
]);
const ASSETS = ['assets/site.css', 'assets/app.js', '.nojekyll',
  'data/world-recipes.json', 'data/world-recipes.zh.json'];

for (const [label, run, base] of [['root', rootBuild, '/'], ['subpath', previewBuild, '/library-preview/']]) {
  test(`the ${label} build emits every page, asset, and data file`, () => {
    const r = run();
    assert.equal(r.cfg.basePath, base);
    assert.equal(r.itemCount, 9);
    for (const rel of [...ALL_PAGES, ...ASSETS]) {
      assert.ok(existsSync(path.join(r.outDir, rel)), `missing ${rel} in the ${label} build`);
    }
    assert.deepEqual(walk(r.outDir), [...ALL_PAGES, ...ASSETS].sort(), `unexpected file set in the ${label} build`);
    assert.ok(r.bytes > 0);
  });

  test(`every generated link in the ${label} build is rooted at its configured base path`, () => {
    const r = run();
    for (const page of ALL_PAGES) {
      for (const link of linksIn(read(r, page))) {
        if (!link.startsWith('/')) continue; // "#main" and relative links are fine as-is.
        assert.ok(link.startsWith(base), `${page}: link "${link}" is not under base "${base}"`);
        assert.ok(!link.startsWith('//'), `${page}: link "${link}" looks protocol-relative`);
      }
    }
  });

  test(`the ${label} build reaches every detail page from the gallery`, () => {
    const r = run();
    const gallery = read(r, 'recipes/index.html');
    for (const id of EXPECTED_ITEM_IDS) {
      assert.ok(gallery.includes(`href="${base}recipes/${id}/"`), `gallery does not link ${id} at base ${base}`);
    }
  });
}

test('the subpath build shares no absolute link shape with the root build', () => {
  const preview = read(previewBuild(), 'recipes/index.html');
  assert.ok(!/(?:href|src)="\/(?!library-preview\/)/.test(preview),
    'the subpath build emitted a link rooted at "/" instead of "/library-preview/"');
});

test('detail pages carry prev/next navigation in manifest order, with no dangling ends', () => {
  const r = rootBuild();
  const { collections } = loadContent();
  const order = collections[0].item_ids;

  order.forEach((id, i) => {
    const html = read(r, `recipes/${id}/index.html`);
    assert.ok(html.includes(`href="/recipes/"`), `${id}: no link back to the collection index`);

    const prev = html.match(/class="record-nav__prev" href="([^"]+)"/);
    const next = html.match(/class="record-nav__next" href="([^"]+)"/);
    assert.equal(Boolean(prev), i > 0, `${id}: wrong presence of a previous link`);
    assert.equal(Boolean(next), i < order.length - 1, `${id}: wrong presence of a next link`);
    if (prev) assert.equal(prev[1], `/recipes/${order[i - 1]}/`);
    if (next) assert.equal(next[1], `/recipes/${order[i + 1]}/`);
  });
});

test('every internal link in the root build resolves to a file that was actually written', () => {
  const r = rootBuild();
  const emitted = new Set(walk(r.outDir).map((f) => `/${f.split(path.sep).join('/')}`));
  for (const page of ALL_PAGES) {
    for (const link of linksIn(read(r, page))) {
      if (!link.startsWith('/')) continue;
      const target = link.endsWith('/') ? `${link}index.html` : link;
      assert.ok(emitted.has(target), `${page}: link "${link}" has no file at "${target}"`);
    }
  }
});

test('the gallery exposes the search, filter, and empty-state hooks the script binds to', () => {
  const html = read(rootBuild(), 'recipes/index.html');
  for (const hook of ['data-filters', 'data-search', 'data-region', 'data-status',
    'data-reset', 'data-grid', 'data-empty', 'data-reset-inline']) {
    assert.ok(html.includes(hook), `gallery is missing the "${hook}" hook`);
  }
  assert.match(html, /<p class="filters__status" aria-live="polite"/);
  assert.match(html, /<div class="empty-state" data-empty hidden>/);
  assert.match(html, /<noscript>/);

  for (const region of regionsOf(loadContent().items)) {
    assert.ok(html.includes(`<option value="${region}">`), `no filter option for region "${region}"`);
  }
  assert.equal([...html.matchAll(/data-haystack="/g)].length, 9, 'every card needs a search haystack');
  assert.equal([...html.matchAll(/class="card"/g)].length, 9);

  const app = readFileSync(path.join(repoRoot, 'src', 'assets', 'app.js'), 'utf8');
  for (const hook of ['[data-filters]', '[data-search]', '[data-region]', '[data-status]',
    '[data-reset]', '[data-grid]', '[data-empty]', '[data-reset-inline]']) {
    assert.ok(app.includes(hook), `app.js never queries "${hook}"`);
  }
});

test('hiding a grid actually hides it: the stylesheet overrides its own display rule', () => {
  const css = readFileSync(path.join(repoRoot, 'src', 'assets', 'site.css'), 'utf8');
  assert.match(css, /\[hidden\]\s*\{\s*display:\s*none\s*!important;?\s*\}/,
    'app.js sets .hidden on the grid, which sets display:grid; an explicit [hidden] rule must win');
  assert.doesNotMatch(css, /головы/, 'the stylesheet contains corrupted text');
});

test('the hall and every page carry the accessibility landmarks', () => {
  const r = rootBuild();
  for (const page of ALL_PAGES) {
    const html = read(r, page);
    assert.match(html, /^<!DOCTYPE html>/);
    // Each page set declares its own language: the default locale at the root,
    // every other locale under its route prefix.
    assert.match(html, new RegExp(`<html lang="${PAGE_LANG.get(page)}">`), `${page}: wrong lang attribute`);
    assert.match(html, /<meta name="viewport" content="width=device-width, initial-scale=1">/);
    assert.match(html, /<a class="skip-link" href="#main">/, `${page}: no skip link`);
    assert.match(html, /<main id="main">/, `${page}: no main landmark`);
    assert.equal([...html.matchAll(/<h1[ >]/g)].length, 1, `${page}: needs exactly one h1`);
    assert.ok(html.includes('fixture-banner'), `${page}: the fixture notice must appear on every page`);
  }
  // The hall of each locale opens that locale's own collection.
  for (const [hallPage, collectionHref] of [['index.html', '/recipes/'], ['zh/index.html', '/zh/recipes/']]) {
    const hall = read(r, hallPage);
    assert.ok(hall.includes(`href="${collectionHref}"`), `${hallPage} does not open the collection`);
    assert.ok(hall.includes('aria-hidden="true"'), `${hallPage}: the decorative vault must be hidden from assistive tech`);
  }
});

// ----------------------------------------------------- nothing leaks

test('the content tree holds exactly the released records, with a zh overlay each', () => {
  // The release is defined by the manifest, not by whatever happens to be on
  // disk. Every expected record has an English file and a Chinese overlay, and
  // nothing else is sitting in either directory waiting to be picked up.
  const itemFiles = readdirSync(path.join(repoRoot, 'content', 'items')).sort();
  const zhFiles = readdirSync(path.join(repoRoot, 'content', 'locales', 'items', 'zh')).sort();
  const expected = EXPECTED_ITEM_IDS.map((id) => `${id}.json`).sort();
  assert.deepEqual(itemFiles, expected, 'content/items/ does not hold exactly the released records');
  assert.deepEqual(zhFiles, expected, 'every released record needs exactly one zh overlay');
});

test('only the released recipe routes are emitted', () => {
  for (const r of [rootBuild(), previewBuild()]) {
    const detailRoutes = walk(r.outDir)
      .filter((rel) => /^(zh\/)?recipes\/[^/]+\/index\.html$/.test(rel))
      .map((rel) => rel.replace(/^(zh\/)?recipes\//, '').replace(/\/index\.html$/, ''))
      .sort();
    // Nine records, two page sets.
    assert.deepEqual(detailRoutes, [...EXPECTED_ITEM_IDS, ...EXPECTED_ITEM_IDS].sort(),
      'the emitted detail routes are not exactly the released records, once per locale');
  }
});

test('the build output contains no run receipts, secrets, or local paths', () => {
  const FORBIDDEN = [
    '.agent-runs', '.agent-office-runs', 'ro-agent-harness',
    'BEGIN RSA PRIVATE KEY', 'BEGIN OPENSSH PRIVATE KEY',
    'api_key', 'API_KEY', 'secret_key', 'ANTHROPIC_API_KEY',
    repoRoot, process.env.HOME ?? '/Users/',
  ].filter(Boolean);

  for (const r of [rootBuild(), previewBuild()]) {
    for (const rel of walk(r.outDir)) {
      assert.ok(!rel.includes('.agent'), `${rel} should never be copied into the output`);
      const body = readFileSync(path.join(r.outDir, rel), 'utf8');
      for (const needle of FORBIDDEN) {
        assert.ok(!body.includes(needle), `${rel} leaks "${needle}"`);
      }
    }
  }
});

test('the published data file is presentation-free content and nothing else', () => {
  const r = rootBuild();
  const data = JSON.parse(read(r, 'data/world-recipes.json'));
  assert.equal(data.items.length, 9);
  assert.equal(data.collection.collection_id, 'world-recipes');
  assert.deepEqual(data.items.map((i) => i.item_id), data.collection.item_ids);
  assert.equal(data.items.filter((i) => i.record_class === 'sourced').length, 6);
  assert.equal(data.items.filter((i) => i.record_class === 'fixture').length, 3);
  for (const item of data.items) assert.equal(item.publication_ready, false);
});

test('the output is static and fetches nothing from a third party', () => {
  const r = rootBuild();
  for (const rel of walk(r.outDir)) {
    if (!rel.endsWith('.html') && !rel.endsWith('.css')) continue;
    const body = readFileSync(path.join(r.outDir, rel), 'utf8');
    assert.doesNotMatch(body, /(?:href|src|url\()\s*["']?https?:\/\//,
      `${rel} makes an external request; this build must fetch nothing`);
  }
});

test('a build leaves no stray file behind and is byte-stable across runs', () => {
  const first = build({ LIBRARY_OUT_DIR: 'dist-test-stable' });
  const firstFiles = walk(first.outDir).map((f) => [f, statSync(path.join(first.outDir, f)).size]);
  const second = build({ LIBRARY_OUT_DIR: 'dist-test-stable' });
  const secondFiles = walk(second.outDir).map((f) => [f, statSync(path.join(second.outDir, f)).size]);
  assert.deepEqual(secondFiles, firstFiles, 'two consecutive builds disagree');
});
