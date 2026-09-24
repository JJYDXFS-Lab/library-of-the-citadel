// Bilingual checks: the localization module, the generated per-locale output,
// and the browser-side language switch. Node standard library only — node:test,
// node:assert, node:fs, node:vm. There is nothing to install.
//
//   node --test tests/*.mjs
//
// The browser script is exercised by running src/assets/app.js inside a vm
// context against a small hand-built DOM. That keeps the switch's real edge
// cases — refused storage, a stale href after filtering, a dropped fragment —
// under test without a browser and without a dependency.

import test, { after } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync, readdirSync, rmSync } from 'node:fs';
import { runInNewContext } from 'node:vm';
import path from 'node:path';

import { repoRoot, loadConfig } from '../src/config.mjs';
import { loadContent } from '../src/content.mjs';
import {
  DEFAULT_LOCALE, LOCALES, LOCALE_CODES, LOCALE_STORAGE_KEY,
  localeByCode, loadDictionaries, format, makeLocale,
  loadOverlay, localizeItem, localizeCollection, localizeView, localizedRegions,
} from '../src/i18n.mjs';
import { build } from '../src/build.mjs';
import { esc } from '../src/templates/pages.mjs';

const EXPECTED_FIXTURE_IDS = [
  'wr-fixture-griddle-flatbread',
  'wr-fixture-rice-porridge',
  'wr-fixture-simmered-bean-soup',
];
const EXPECTED_SOURCED_IDS = [
  'wr-oven-lamb-kofta-traybake',
  'wr-oven-lamb-potato-bake',
  'wr-oven-chicken-thigh-traybake',
  'wr-oven-salmon-traybake',
  'wr-oven-halloumi-chickpea-traybake',
  'wr-oven-root-veg-traybake',
];
// The Quick Air-Fryer section: original practical notes, a third record class
// that is neither sourced nor fixture. In manifest order.
const EXPECTED_PRACTICAL_IDS = [
  'wr-airfryer-crispy-tofu',
  'wr-airfryer-chicken-thigh-bites',
  'wr-airfryer-salmon-fillet',
  'wr-airfryer-broccoli-mixed-veg',
  'wr-airfryer-sweet-potato-wedges',
  'wr-airfryer-bean-cheese-quesadilla',
  'wr-airfryer-frozen-veg-dumplings',
  'wr-airfryer-garlic-lemon-salmon',
];
const QUICK_AIR_FRYER = 'quick-air-fryer';
const EXPECTED_ITEM_IDS = [
  ...EXPECTED_SOURCED_IDS, ...EXPECTED_PRACTICAL_IDS, ...EXPECTED_FIXTURE_IDS,
];
// The published stories. Their bilingual behaviour differs from a record's by
// design — the body is the same canonical text in both page sets, whether that
// text is in one language or two — so it is covered in tests/stories.mjs; here
// they only have to appear in every per-locale page-set assertion, like any
// other route.
const EXPECTED_STORY_IDS = ['citadel-night-dialogue-on-relation', 'the-third-chair', 'agent-kindergarten',
  'agent-kindergarten-no-character-sheet'];

// Each class states what it is in its own words, in each language. A reader
// must never have to guess which kind of record they are looking at.
const ZH_CLASS_DISCLAIMER = {
  sourced: /有来源的记录/,
  'practical-note': /原创实用笔记/,
  fixture: /示例记录/,
};

const readJson = (...parts) => JSON.parse(readFileSync(path.join(repoRoot, ...parts), 'utf8'));
const baseItem = (id) => readJson('content', 'items', `${id}.json`);
const baseCollection = () => readJson('content', 'collections', 'world-recipes.json');

function cleanTestOutputs() {
  rmSync(path.join(repoRoot, 'dist-test-locale'), { recursive: true, force: true });
}
after(cleanTestOutputs);
process.on('exit', cleanTestOutputs);

let cached = null;
function localeBuild() {
  if (!cached) cached = build({ LIBRARY_OUT_DIR: 'dist-test-locale' });
  return cached;
}
const read = (r, rel) => readFileSync(path.join(r.outDir, rel), 'utf8');

// =================================================== the module: dictionaries

test('the locale table is well formed and English owns the site root', () => {
  assert.equal(DEFAULT_LOCALE, 'en');
  assert.deepEqual(LOCALE_CODES, ['en', 'zh']);
  assert.equal(localeByCode('en').prefix, '', 'the default locale must not take a route prefix');
  assert.equal(localeByCode('zh').prefix, 'zh/');
  assert.equal(localeByCode('zh').htmlLang, 'zh-Hans');
  assert.equal(localeByCode('nope'), undefined);

  const prefixes = LOCALES.map((l) => l.prefix);
  assert.equal(new Set(prefixes).size, prefixes.length, 'two locales share a route prefix');
  for (const loc of LOCALES) {
    assert.ok(loc.endonym.trim(), `${loc.code} has no endonym to label its own switch entry`);
    if (loc.code !== DEFAULT_LOCALE) assert.match(loc.prefix, /^[a-z-]+\/$/);
  }
});

test('every interface dictionary is complete, non-empty, and free of extra keys', () => {
  const dicts = loadDictionaries();
  assert.deepEqual([...dicts.keys()], LOCALE_CODES);

  const en = dicts.get('en');
  const zh = dicts.get('zh');
  assert.equal(en.$comment, undefined, 'the $comment scaffold must not reach a dictionary lookup');

  const uiKeys = (d) => Object.keys(d).filter((k) => !k.startsWith('site.')).sort();
  assert.deepEqual(uiKeys(zh), uiKeys(en), 'the zh dictionary is not key-for-key with en');
  assert.ok(uiKeys(en).length > 50, 'the dictionary should cover the whole interface');

  for (const [code, dict] of dicts) {
    for (const [key, value] of Object.entries(dict)) {
      assert.equal(typeof value, 'string', `${code}: "${key}" is not a string`);
      assert.notEqual(value.trim(), '', `${code}: "${key}" is empty`);
    }
  }

  // The default locale reads its four site strings from config; every other
  // locale must supply them, because the config file holds one language only.
  for (const key of ['site.tagline', 'site.build_notice', 'site.footer_note', 'site.citadel_note']) {
    assert.equal(en[key], undefined, `en must not duplicate ${key}; config/site.config.json owns it`);
    assert.equal(typeof zh[key], 'string', `zh is missing ${key}`);
  }

  // Placeholders are part of the contract: a translation may reorder them but
  // must not invent or drop one.
  const placeholders = (s) => [...String(s).matchAll(/\{(\w+)\}/g)].map((m) => m[1]).sort();
  for (const key of uiKeys(en)) {
    assert.deepEqual(placeholders(zh[key]), placeholders(en[key]), `zh "${key}" has different placeholders`);
  }
});

test('interface text fails closed instead of falling back to English or a raw key', () => {
  const cfg = loadConfig({});
  const dicts = loadDictionaries();
  const gapped = new Map(dicts);
  const partial = { ...dicts.get('zh') };
  delete partial['nav.hall'];
  gapped.set('zh', partial);

  const L = makeLocale(cfg, 'zh', gapped);
  assert.throws(() => L.t('nav.hall'), /Missing interface string "nav.hall" for locale "zh"/);
  assert.throws(() => makeLocale(cfg, 'fr', dicts), /Unknown locale "fr"/);
});

test('format substitutes braced placeholders and refuses an unsupplied one', () => {
  assert.equal(format('Showing {shown} of {total}.', { shown: 2, total: 3 }), 'Showing 2 of 3.');
  assert.equal(format('no placeholders'), 'no placeholders');
  assert.throws(() => format('Served from {basePath}.', {}), /No value supplied for placeholder "\{basePath\}"/);
});

test('a locale context links inside its own locale and across to the other one', () => {
  const cfg = loadConfig({});
  const sub = loadConfig({ LIBRARY_BASE_PATH: '/library-preview/' });
  const en = makeLocale(cfg, 'en');
  const zh = makeLocale(cfg, 'zh');

  assert.equal(en.path(''), '/');
  assert.equal(en.path('recipes/'), '/recipes/');
  assert.equal(zh.path('recipes/'), '/zh/recipes/');
  assert.equal(en.pathIn('zh', 'recipes/wr-fixture-rice-porridge/'), '/zh/recipes/wr-fixture-rice-porridge/');
  assert.equal(zh.pathIn('en', 'recipes/wr-fixture-rice-porridge/'), '/recipes/wr-fixture-rice-porridge/');
  assert.throws(() => en.pathIn('fr', ''), /Unknown locale "fr"/);

  // The same two helpers under a subpath deployment.
  assert.equal(makeLocale(sub, 'zh').path('about/'), '/library-preview/zh/about/');
  assert.equal(makeLocale(sub, 'zh').pathIn('en', 'about/'), '/library-preview/about/');

  assert.equal(en.isDefault, true);
  assert.equal(zh.isDefault, false);
  assert.equal(zh.htmlLang, 'zh-Hans');
  // en takes its site strings from config; zh takes them from its dictionary.
  assert.equal(en.site.tagline, cfg.tagline);
  assert.notEqual(zh.site.tagline, cfg.tagline);
  for (const value of Object.values(zh.site)) assert.equal(typeof value, 'string');
});

// ======================================================= the module: overlays

test('an overlay is looked up by stable ID, and a missing one is a normal state', () => {
  assert.equal(loadOverlay('items', 'en', 'wr-fixture-rice-porridge'), null,
    'the source language must never read an overlay');
  assert.equal(loadOverlay('items', 'zh', 'wr-fixture-does-not-exist'), null,
    'a missing translation is the untranslated state, not an error');
  for (const id of EXPECTED_ITEM_IDS) {
    const overlay = loadOverlay('items', 'zh', id);
    assert.ok(overlay, `no zh overlay for ${id}`);
    assert.equal(overlay.$comment, undefined, 'the $comment scaffold must not reach the record');
  }
  assert.ok(loadOverlay('collections', 'zh', 'world-recipes'));
});

test('an untranslated record falls back to the English original, whole and unchanged', () => {
  const item = baseItem('wr-fixture-simmered-bean-soup');
  const { record, state, english, canonicalRegion } = localizeItem(item, null, 'zh');
  assert.equal(state, 'none');
  assert.deepEqual(record, item, 'the fallback record must be the English record, field for field');
  assert.equal(english, item);
  assert.equal(canonicalRegion, item.region.label);
  assert.deepEqual(item, baseItem('wr-fixture-simmered-bean-soup'), 'localization mutated the base record');
});

test('a half-written overlay is reported as partial and leaves the rest in English', () => {
  const item = baseItem('wr-fixture-rice-porridge');
  const { record, state } = localizeItem(item, { name: { primary: '米粥' } }, 'zh');
  assert.equal(state, 'partial');
  assert.equal(record.name.primary, '米粥');
  assert.equal(record.summary, item.summary, 'an untranslated field must keep the English original');
  assert.equal(record.method[0].instruction, item.method[0].instruction);

  // A list translation is all-or-nothing: a wrong-length or blank-padded list is
  // not usable, so the English list stands rather than a half-empty one.
  const short = localizeItem(item, { safety: { caveats: ['只有一条'] } }, 'zh');
  assert.deepEqual(short.record.safety.caveats, item.safety.caveats);
  const blank = localizeItem(item, { summary: '   ' }, 'zh');
  assert.equal(blank.record.summary, item.summary, 'a whitespace-only translation is not a translation');
  assert.equal(blank.state, 'none', 'no usable field means the record is untranslated, not partly translated');

  assert.equal(localizeItem(item, null, 'en').state, 'source');
});

const HAN = /[㐀-䶿一-鿿]/;

/**
 * Whether an English original carries words that a translator has to replace.
 * A field that is only digits, punctuation and units of notation — the bay
 * leaf's quantity "1" — reads the same in both languages, so finding it inside
 * the Chinese "1 片" is the numeral being kept, not the field being left in
 * English. Such a field is still held to `notEqual` and to the Han check.
 */
const carriesEnglishWords = (s) => /[A-Za-z]/.test(String(s));

/**
 * Every prose slot that a complete zh translation must actually carry in
 * Chinese, paired with its English original. Alternative names are excluded on
 * purpose: `name.alt` and `title.alt` hold proper names, attributions, and
 * cross-language aliases, so a translated record legitimately keeps English
 * text there — which is also what makes bilingual search work. The check runs
 * field by field rather than over the serialized record for exactly that
 * reason.
 */
function translatablePairs(english, localized) {
  const pairs = [
    ['record_notice', english.record_notice, localized.record_notice],
    ['name.primary', english.name.primary, localized.name.primary],
    ['summary', english.summary, localized.summary],
    ['provenance_note', english.provenance_note, localized.provenance_note],
    ['region.label', english.region.label, localized.region.label],
    ['region.cuisine_label', english.region.cuisine_label, localized.region.cuisine_label],
    ['rights.content_license', english.rights.content_license, localized.rights.content_license],
    ...english.method.map((m, i) => [`method[${m.step}]`, m.instruction, localized.method[i].instruction]),
    ...english.safety.caveats.map((c, i) => [`safety.caveats[${i}]`, c, localized.safety.caveats[i]]),
    ...english.variants.flatMap((v, i) => [
      [`variants.${v.variant_id}.label`, v.label, localized.variants[i].label],
      [`variants.${v.variant_id}.region_label`, v.region_label, localized.variants[i].region_label],
      [`variants.${v.variant_id}.difference_note`, v.difference_note, localized.variants[i].difference_note],
    ]),
    ...english.ingredients.flatMap((g, i) => Object.keys(g)
      .map((field) => [`ingredients[${i}].${field}`, g[field], localized.ingredients[i][field]])),
    ...english.change_history.map((h, i) => [`change_history.${h.version}`, h.change, localized.change_history[i].change]),
  ];
  if (english.yield_note) pairs.push(['yield_note', english.yield_note, localized.yield_note]);
  return pairs;
}

test('every record is fully translated into zh, with no English left behind', () => {
  for (const id of EXPECTED_ITEM_IDS) {
    const item = baseItem(id);
    const { record, state } = localizeItem(item, loadOverlay('items', 'zh', id), 'zh');
    assert.equal(state, 'complete', `${id}: the zh overlay does not fill every translatable slot`);

    for (const [field, english, localized] of translatablePairs(item, record)) {
      assert.ok(String(localized).trim(), `${id}: ${field} is empty in zh`);
      assert.notEqual(localized, english, `${id}: ${field} is still the English original`);
      if (carriesEnglishWords(english)) {
        assert.ok(!String(localized).includes(english), `${id}: ${field} still carries its English original`);
      }
      assert.match(localized, HAN, `${id}: ${field} was never written in Chinese`);
    }

    // The disclaimer and the safety caveats are the two things a reader must
    // not have to read in a language they did not choose. Each class of record
    // has its own disclaimer, and the translated one must say the same thing:
    // a fixture is a demonstration, a sourced record is checked but untested,
    // an original practical note was written here and cites nobody.
    assert.match(record.record_notice, ZH_CLASS_DISCLAIMER[item.record_class],
      `${id}: the ${item.record_class} disclaimer is not in Chinese`);
    assert.equal(record.safety.caveats.length, item.safety.caveats.length, `${id}: a safety caveat was dropped`);

    // Alternative names stay as written: translated where a translation exists,
    // English where the alias is the point.
    assert.equal(record.name.alt.length, item.name.alt.length, `${id}: an alternative name was dropped`);
  }

  const collection = baseCollection();
  const localizedCollection = localizeCollection(collection, loadOverlay('collections', 'zh', 'world-recipes'), 'zh');
  assert.equal(localizedCollection.state, 'complete');
  for (const [field, english, localized] of [
    ['record_notice', collection.record_notice, localizedCollection.record.record_notice],
    ['title.primary', collection.title.primary, localizedCollection.record.title.primary],
    ['description', collection.description, localizedCollection.record.description],
    ['scope_note', collection.scope_note, localizedCollection.record.scope_note],
  ]) {
    assert.notEqual(localized, english, `world-recipes: ${field} is still the English original`);
    assert.match(localized, HAN, `world-recipes: ${field} was never written in Chinese`);
  }
  assert.equal(localizeCollection(collection, null, 'zh').state, 'none');
  assert.equal(localizeCollection(collection, null, 'en').state, 'source');
});

test('translating a record moves no ID and changes no part of the data contract', () => {
  for (const id of EXPECTED_ITEM_IDS) {
    const item = baseItem(id);
    const { record } = localizeItem(item, loadOverlay('items', 'zh', id), 'zh');

    assert.deepEqual(Object.keys(record).sort(), Object.keys(item).sort(), `${id}: field set changed`);
    assert.equal(record.item_id, item.item_id);
    assert.equal(record.collection_id, item.collection_id);
    assert.equal(record.schema_version, item.schema_version);
    // Translating never reclassifies a record or moves its provenance: whatever
    // class and sources the English record has, the localized one has exactly.
    assert.equal(record.record_class, item.record_class);
    assert.equal(record.publication_ready, false);
    assert.deepEqual(record.sources, item.sources);
    assert.equal(record.source_state, item.source_state);
    assert.equal(record.reviewed_at, item.reviewed_at);
    assert.equal(record.record_version, item.record_version);
    assert.deepEqual(record.tags, item.tags, 'tags are machine facets and stay canonical');
    assert.equal(record.region.label_basis, item.region.label_basis);
    assert.equal(record.safety.review_state, item.safety.review_state);
    assert.equal(record.rights.license_review_state, item.rights.license_review_state);
    assert.equal(record.rights.image_rights_review_state, item.rights.image_rights_review_state);
    assert.deepEqual(record.rights.images, []);

    assert.deepEqual(record.variants.map((v) => v.variant_id), item.variants.map((v) => v.variant_id));
    assert.deepEqual(record.method.map((m) => m.step), item.method.map((m) => m.step));
    assert.equal(record.ingredients.length, item.ingredients.length);
    assert.deepEqual(record.change_history.map((h) => h.version), item.change_history.map((h) => h.version));
    assert.deepEqual(record.change_history.map((h) => h.date), item.change_history.map((h) => h.date));
    assert.deepEqual(record.change_history.map((h) => h.supersedes), item.change_history.map((h) => h.supersedes));
    assert.deepEqual(record.safety.caveats.length, item.safety.caveats.length);
    assert.equal(record.record_notice.length > 0, true);

    // An ingredient row keeps whichever optional fields the canonical row had,
    // and grows none it did not.
    item.ingredients.forEach((row, i) => {
      assert.deepEqual(Object.keys(record.ingredients[i]).sort(), Object.keys(row).sort(),
        `${id}: ingredient ${i} changed shape`);
    });

    assert.deepEqual(item, baseItem(id), `${id}: the base record was mutated in place`);
  }
});

test('a region filter value stays canonical English so a filtered link survives a switch', () => {
  const { collections, items } = loadContent();
  const ordered = collections[0].item_ids.map((id) => items.find((i) => i.item_id === id));
  const canonical = [...new Set(ordered.map((i) => i.region.label))].sort();

  const en = localizedRegions(localizeView('en', { collection: collections[0], items: ordered }).entries);
  const zh = localizedRegions(localizeView('zh', { collection: collections[0], items: ordered }).entries);

  assert.equal(en.length, canonical.length);
  assert.equal(zh.length, canonical.length);
  assert.ok(canonical.length >= 3, 'the region filter needs a usable spread');
  assert.deepEqual(en.map((r) => r.value).sort(), canonical);
  assert.deepEqual(zh.map((r) => r.value).sort(), canonical, 'the zh filter values must stay English');
  assert.deepEqual(en.map((r) => r.label), en.map((r) => r.value), 'en labels are the canonical labels');
  for (const region of zh) {
    assert.notEqual(region.label, region.value, `the zh label for "${region.value}" was never translated`);
    assert.doesNotMatch(region.label, /[A-Za-z]/, `the zh label for "${region.value}" still reads as English`);
  }
  assert.deepEqual(zh.map((r) => r.label), [...zh.map((r) => r.label)].sort((a, b) => a.localeCompare(b, 'en')));
});

test('a locale view keeps manifest order and pairs every record with its state', () => {
  const { collections, items } = loadContent();
  const ordered = collections[0].item_ids.map((id) => items.find((i) => i.item_id === id));
  for (const code of LOCALE_CODES) {
    const view = localizeView(code, { collection: collections[0], items: ordered });
    assert.deepEqual(view.entries.map((e) => e.record.item_id), collections[0].item_ids, `${code}: order drifted`);
    assert.equal(view.collection.record.collection_id, 'world-recipes');
    const expected = code === DEFAULT_LOCALE ? 'source' : 'complete';
    for (const entry of view.entries) assert.equal(entry.state, expected, `${code}/${entry.record.item_id}`);
  }
});

// ==================================================== the generated page sets

const PAGE_ROUTES = ['index.html', 'recipes/index.html', 'stories/index.html', 'about/index.html',
  ...EXPECTED_ITEM_IDS.map((id) => `recipes/${id}/index.html`),
  ...EXPECTED_STORY_IDS.map((id) => `stories/${id}/index.html`)];
const pagesFor = (loc) => PAGE_ROUTES.map((rel) => `${loc.prefix}${rel}`);

test('the build emits one complete page set per locale, plus one data file each', () => {
  const r = localeBuild();
  assert.deepEqual(r.locales, LOCALE_CODES);
  for (const loc of LOCALES) {
    for (const rel of pagesFor(loc)) {
      assert.ok(existsSync(path.join(r.outDir, rel)), `missing ${rel}`);
    }
  }
  assert.ok(existsSync(path.join(r.outDir, 'data', 'world-recipes.json')));
  assert.ok(existsSync(path.join(r.outDir, 'data', 'world-recipes.zh.json')));
  // The story shelf exports once rather than once per locale: a story record
  // already carries its own metadata for every locale, and its body is the same
  // canonical text in all of them.
  assert.deepEqual(readdirSync(path.join(r.outDir, 'data')).sort(),
    ['stories.json', 'world-recipes.json', 'world-recipes.zh.json']);
});

test('each page set declares its own language and keeps the shared slugs', () => {
  const r = localeBuild();
  for (const loc of LOCALES) {
    for (const rel of pagesFor(loc)) {
      const html = read(r, rel);
      assert.match(html, new RegExp(`<html lang="${loc.htmlLang}">`), `${rel}: wrong lang attribute`);
      assert.ok(html.includes('data-locale-switch'), `${rel}: no language switch`);
      assert.ok(html.includes(`data-locale-current="${loc.code}"`), `${rel}: wrong current locale`);
      assert.ok(html.includes(`data-locale-key="${LOCALE_STORAGE_KEY}"`), `${rel}: no storage key on the switch`);
      // Both locales are always offered, as real links, so the switch works
      // with scripting disabled.
      for (const other of LOCALES) {
        assert.ok(html.includes(`data-locale-code="${other.code}"`), `${rel}: no switch entry for ${other.code}`);
      }
    }
  }
});

// The exact line the site is required to carry, character for character, on
// every page of every locale. It names the holders and reserves their rights;
// both are legal formulae, so neither is translated, the way a name is not.
const REQUIRED_COPYRIGHT = '© 2026 JJYDXFS & Atom (原子). All rights reserved.';
const JJYDXFS_LINK = '<a href="https://jjydxfs.github.io/">JJYDXFS</a>';
const ATOM_LINK = '<a href="https://atom-of-jjydxfs.github.io/">Atom (原子)</a>';
const REQUIRED_DEVELOPMENT_CREDIT = '<p class="colophon__development">Developed by Atom (原子) &amp; Claude.</p>';

test('every page in both locales carries the exact required footer credit and its own rights note', () => {
  const r = localeBuild();
  const cfg = loadConfig({});
  const dicts = loadDictionaries();

  assert.equal(cfg.copyright.year, 2026);
  assert.equal(cfg.copyright.holders, 'JJYDXFS & Atom (原子)');
  assert.equal(cfg.copyright.reserved, 'All rights reserved.');
  assert.equal(cfg.copyright.links.JJYDXFS, 'https://jjydxfs.github.io/');
  assert.equal(cfg.copyright.links['Atom (原子)'], 'https://atom-of-jjydxfs.github.io/');

  for (const loc of LOCALES) {
    const other = LOCALES.find((l) => l.code !== loc.code);
    const note = esc(dicts.get(loc.code)['footer.rights_note']);
    const foreign = esc(dicts.get(other.code)['footer.rights_note']);
    for (const rel of pagesFor(loc)) {
      const html = read(r, rel);
      const line = /<p class="colophon__copyright">([\s\S]*?)<\/p>/.exec(html);
      assert.ok(line, `${rel}: no copyright line`);
      // Each holder is linked to its own address, and only to its own.
      assert.ok(line[1].includes(JJYDXFS_LINK), `${rel}: "JJYDXFS" is not linked to the configured URL`);
      assert.ok(line[1].includes(ATOM_LINK), `${rel}: "Atom (原子)" is not linked to the configured URL`);
      assert.equal([...line[1].matchAll(/<a\b/g)].length, 2, `${rel}: the credit line links something other than the two holders`);
      // Markup removed and entities decoded: what a reader actually sees. The
      // links must not change one character of it.
      const visible = line[1].replace(/<[^>]*>/g, '').replace(/&amp;/g, '&');
      assert.equal(visible, REQUIRED_COPYRIGHT, `${rel}: the visible copyright text is not the required line`);
      assert.equal(
        html.split(REQUIRED_DEVELOPMENT_CREDIT).length - 1,
        1,
        `${rel}: the development credit is missing or duplicated`,
      );
      // The superseded credit must be gone from the page entirely, not merely
      // from the copyright element.
      assert.ok(!html.includes('Atom &amp; Claude'), `${rel}: the old "Atom & Claude" credit survives`);
      assert.ok(html.includes(`<p class="colophon__rights">${note}</p>`), `${rel}: no ${loc.code} rights note`);
      assert.ok(!html.includes(foreign), `${rel}: shows the ${other.code} rights note instead of its own`);
    }
  }
});

test('the switch on every page points at the same route in the other locale', () => {
  const r = localeBuild();
  const hrefOf = (html, code) => {
    const m = new RegExp(`<a href="([^"]+)"[^>]*data-locale-code="${code}"`).exec(html);
    assert.ok(m, `no switch link for ${code}`);
    return m[1];
  };
  for (const rel of PAGE_ROUTES) {
    const route = rel.replace(/index\.html$/, '');
    assert.equal(hrefOf(read(r, rel), 'zh'), `/zh/${route}`, `${rel}: wrong zh target`);
    assert.equal(hrefOf(read(r, `zh/${rel}`), 'en'), `/${route}`, `zh/${rel}: wrong en target`);
    assert.equal(hrefOf(read(r, `zh/${rel}`), 'zh'), `/zh/${route}`, `zh/${rel}: self link is not self`);
  }
});

/**
 * The text a reader actually sees: markup, and therefore every attribute value,
 * removed. The gallery deliberately carries `{shown}`/`{total}` templates in
 * data-status-* attributes for the browser to fill in at filter time, so a
 * placeholder check has to look at rendered text rather than at raw HTML.
 */
const visibleText = (html) => html
  .replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, ' ')
  .replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi, ' ')
  .replace(/<[^>]*>/g, ' ');

test('no raw interface key and no dotted placeholder reaches a generated page', () => {
  const r = localeBuild();
  const keys = Object.keys(loadDictionaries().get('en'));
  for (const loc of LOCALES) {
    for (const rel of pagesFor(loc)) {
      const html = read(r, rel);
      for (const key of keys) {
        assert.ok(!html.includes(key), `${rel} leaks the raw interface key "${key}"`);
      }
      assert.doesNotMatch(visibleText(html), /\{\w+\}/, `${rel} shows an unsubstituted placeholder`);
      assert.ok(!html.includes('undefined'), `${rel} rendered an undefined value`);
    }

    // The one place a placeholder is meant to survive the build: the status
    // templates the script fills in. They must be present, in this locale, with
    // their placeholders intact.
    const gallery = read(r, `${loc.prefix}recipes/index.html`);
    for (const [attr, placeholders] of [
      ['data-status-all', ['{total}']],
      ['data-status-some', ['{shown}', '{total}']],
      ['data-status-none', []],
    ]) {
      const template = new RegExp(`${attr}="([^"]*)"`).exec(gallery);
      assert.ok(template, `${loc.code} gallery: no "${attr}" template for the script to fill in`);
      for (const placeholder of placeholders) {
        assert.ok(template[1].includes(placeholder),
          `${loc.code} gallery: "${attr}" lost its "${placeholder}" placeholder`);
      }
    }
  }
});

test('the zh pages are actually in Chinese and the en pages are untouched', () => {
  const r = localeBuild();
  const zhGallery = read(r, 'zh/recipes/index.html');
  const enGallery = read(r, 'recipes/index.html');

  // What each page set *shows* as its own title, not what its HTML happens to
  // contain. The English records carry Chinese aliases on purpose — the
  // collection's title.alt is 世界食谱 and the rice porridge record's name.alt is
  // 米粥 — and the build both displays those aliases and folds them into the
  // card haystack, which is what makes a search typed in either language work.
  // So Chinese in the English HTML is expected; Chinese as the English page's
  // heading or card title is the leak worth failing on.
  const headingOf = (html) => /<h1>([^<]*)/.exec(html)?.[1];
  const cardTitles = (html) => [...html.matchAll(/<h3 class="card__title">([^<]*)<\/h3>/g)].map((m) => m[1]);
  const haystacks = (html) => [...html.matchAll(/data-haystack="([^"]*)"/g)].map((m) => m[1]);

  const collection = baseCollection();
  const porridge = collection.item_ids.indexOf('wr-fixture-rice-porridge');
  const zhOverlay = loadOverlay('collections', 'zh', 'world-recipes');

  assert.equal(headingOf(zhGallery), zhOverlay.title.primary,
    'the zh gallery does not show the translated collection title');
  assert.deepEqual(cardTitles(zhGallery),
    collection.item_ids.map((id) => loadOverlay('items', 'zh', id).name.primary),
    'a zh card does not show its translated record name');
  assert.equal(cardTitles(zhGallery)[porridge], '米粥');

  assert.equal(headingOf(enGallery), collection.title.primary,
    'the English gallery heading is not the English collection title');
  assert.deepEqual(cardTitles(enGallery), collection.item_ids.map((id) => baseItem(id).name.primary),
    'a translated title leaked into the English page set');

  // Translated prose — a summary, a description, the fixture notice — is not an
  // alias and has no business on an English page.
  for (const [field, text] of [
    ['description', zhOverlay.description],
    ['record_notice', zhOverlay.record_notice],
    ['summary', loadOverlay('items', 'zh', 'wr-fixture-rice-porridge').summary],
  ]) {
    assert.ok(!enGallery.includes(text), `a translated ${field} leaked into the English page set`);
  }

  // The aliases themselves must survive in both sets: dropping them would make
  // this test pass and bilingual search stop working.
  assert.ok(haystacks(enGallery).some((h) => h.includes('米粥')),
    'the English page set lost the Chinese alias that lets a Chinese query find the record');
  assert.ok(haystacks(zhGallery).some((h) => h.includes('rice porridge')),
    'the zh page set lost the English original that lets an English query find the record');

  // The filter option values stay canonical English in both page sets, so
  // ?region= is shareable across languages; only the option text is localized.
  for (const region of ['East Asia', 'Mediterranean', 'West Asia']) {
    assert.ok(zhGallery.includes(`<option value="${region}">`), `zh gallery lost the canonical value "${region}"`);
    assert.ok(enGallery.includes(`<option value="${region}">`), `en gallery lost the canonical value "${region}"`);
  }
  assert.ok(!zhGallery.includes('>East Asia<'), 'the zh option text was never translated');

  // Complete translations mean no page in either set shows a fallback notice.
  for (const loc of LOCALES) {
    for (const rel of pagesFor(loc)) {
      assert.ok(!read(r, rel).includes('translation-notice'),
        `${rel} shows an untranslated-fallback notice, but every record is translated`);
    }
  }
});

test('every zh link stays inside the zh page set, and every link resolves to a file', () => {
  const r = localeBuild();
  const emitted = new Set([...pagesFor(LOCALES[0]), ...pagesFor(LOCALES[1])].map((f) => `/${f}`));
  for (const rel of pagesFor(localeByCode('zh'))) {
    const html = read(r, rel);
    for (const link of [...html.matchAll(/href="([^"]*)"/g)].map((m) => m[1])) {
      if (!link.startsWith('/')) continue;
      if (link.startsWith('/assets/')) continue;
      // A lens affordance carries a query and a fragment; the file it resolves
      // to is the route in front of them.
      const route = link.split('#')[0].split('?')[0];
      const target = route.endsWith('/') ? `${route}index.html` : route;
      assert.ok(emitted.has(target), `${rel}: link "${link}" has no file at "${target}"`);
      // The one link that legitimately leaves the zh tree is the switch back to
      // English; everything else must stay under /zh/.
      const isSwitch = new RegExp(`href="${link}"[^>]*data-locale-code="en"`).test(html);
      if (!isSwitch) assert.ok(link.startsWith('/zh/'), `${rel}: link "${link}" escapes the zh page set`);
    }
  }
});

test('the per-locale data files are the same records with the same IDs', () => {
  const r = localeBuild();
  const en = JSON.parse(read(r, 'data/world-recipes.json'));
  const zh = JSON.parse(read(r, 'data/world-recipes.zh.json'));
  const { collections } = loadContent();

  assert.equal(en.locale, 'en');
  assert.equal(zh.locale, 'zh');
  assert.deepEqual(zh.items.map((i) => i.item_id), en.items.map((i) => i.item_id));
  assert.deepEqual(en.items.map((i) => i.item_id), collections[0].item_ids);
  assert.deepEqual(zh.collection.item_ids, en.collection.item_ids);
  assert.equal(zh.collection.collection_id, 'world-recipes');

  // The default-locale export stays byte-faithful to the canonical records.
  const ordered = collections[0].item_ids.map((id) => baseItem(id));
  assert.deepEqual(en.items, ordered, 'the en data file is no longer the canonical English record set');

  assert.deepEqual(en.translation_state, Object.fromEntries(EXPECTED_ITEM_IDS.map((id) => [id, 'source'])));
  assert.deepEqual(zh.translation_state, Object.fromEntries(EXPECTED_ITEM_IDS.map((id) => [id, 'complete'])));
  // The zh export carries the same provenance as the canonical record it
  // translates — a fixture stays sourceless, a sourced record keeps its sources
  // — and neither ever claims a review or publication readiness it lacks.
  const canonical = new Map(ordered.map((i) => [i.item_id, i]));
  for (const item of zh.items) {
    const en_ = canonical.get(item.item_id);
    assert.equal(item.record_class, en_.record_class);
    assert.deepEqual(item.sources, en_.sources);
    assert.equal(item.publication_ready, false);
    assert.notEqual(item.safety.review_state, 'reviewed');
    if (item.record_class === 'fixture') assert.deepEqual(item.sources, []);
    if (item.record_class === 'practical-note') {
      assert.deepEqual(item.sources, [], `${item.item_id}: a translated practical note grew a source`);
      assert.equal(item.source_state, 'none-authored-here');
    }
  }
  const classes = zh.items.map((i) => i.record_class);
  assert.equal(classes.filter((c) => c === 'sourced').length, 6);
  assert.equal(classes.filter((c) => c === 'practical-note').length, 8);
  assert.equal(classes.filter((c) => c === 'fixture').length, 3);
  assert.equal(zh.items.length, 17);
  // The section travels into both data files, with untranslated membership.
  for (const data of [en, zh]) {
    assert.deepEqual(data.collection.sections.map((s) => s.section_id), [QUICK_AIR_FRYER]);
    assert.deepEqual(data.collection.sections[0].item_ids, EXPECTED_PRACTICAL_IDS);
  }
  assert.notEqual(zh.collection.sections[0].title, en.collection.sections[0].title);
});

// ===================================== the sourced records, in both languages

/** Every number in a string, normalized so "1,5" and "1.5" compare equal. */
const numbersIn = (s) => (String(s).match(/\d+(?:[.,]\d+)?/g) ?? [])
  .map((n) => n.replace(',', '.'))
  .sort();

test('the zh translation repeats every number exactly, in sourced records and practical notes alike', () => {
  // A quantity, a temperature, a time or a cook-to threshold that drifts
  // between languages is the one translation bug that could actually hurt
  // someone, so it is checked field by field rather than by eye. The practical
  // notes are held to it for the same reason the sourced records are: nothing
  // about being written here rather than retrieved makes a drifted 75 safer.
  for (const id of [...EXPECTED_SOURCED_IDS, ...EXPECTED_PRACTICAL_IDS]) {
    const item = baseItem(id);
    const { record } = localizeItem(item, loadOverlay('items', 'zh', id), 'zh');
    for (const [field, english, localized] of translatablePairs(item, record)) {
      assert.deepEqual(numbersIn(localized), numbersIn(english),
        `${id}: ${field} — zh has ${JSON.stringify(numbersIn(localized))}, en has ${JSON.stringify(numbersIn(english))}`);
    }
  }
});

test('the zh air-fryer notes stay Celsius-only and keep the poultry figure at 75°C', () => {
  for (const id of EXPECTED_PRACTICAL_IDS) {
    const { record } = localizeItem(baseItem(id), loadOverlay('items', 'zh', id), 'zh');
    const text = JSON.stringify(record);
    assert.doesNotMatch(text, /°F|华氏/, `${id}: the zh overlay introduced a Fahrenheit figure`);
    assert.match(text, /°C/, `${id}: the zh overlay lost its Celsius temperature`);
  }

  const chicken = localizeItem(
    baseItem('wr-airfryer-chicken-thigh-bites'),
    loadOverlay('items', 'zh', 'wr-airfryer-chicken-thigh-bites'), 'zh').record;
  const zhText = `${chicken.method.map((m) => m.instruction).join(' ')} ${chicken.safety.caveats.join(' ')}`;
  assert.match(zhText, /75°C/, 'the zh poultry note does not carry the 75°C figure');
  assert.match(zhText, /最厚/, 'the zh poultry note does not tie the reading to the thickest part');
  assert.match(zhText, /食品安全/, 'the zh poultry note does not hand the reader back to a food-safety authority');

  const salmon = localizeItem(
    baseItem('wr-airfryer-salmon-fillet'),
    loadOverlay('items', 'zh', 'wr-airfryer-salmon-fillet'), 'zh').record;
  const zhFish = `${salmon.method.map((m) => m.instruction).join(' ')} ${salmon.safety.caveats.join(' ')}`;
  assert.deepEqual([...zhFish.matchAll(/(\d+)\s*°C/g)].map((m) => Number(m[1])), [180],
    'the zh fish note states a temperature the English record deliberately does not');
});

test('every sourced record carries a source, an attribution and one access date', () => {
  for (const id of EXPECTED_SOURCED_IDS) {
    const item = baseItem(id);
    assert.equal(item.record_class, 'sourced');
    assert.ok(item.sources.length >= 1, `${id}: no source`);
    for (const source of item.sources) {
      assert.match(source.url, /^https:\/\//, `${id}: source URL is not https`);
      assert.equal(source.accessed_at, '2026-09-14', `${id}: unexpected access date`);
      assert.ok(source.title.trim(), `${id}: a source has no title`);
    }
    // A safety threshold in the method must come with the authority behind it.
    const method = item.method.map((m) => m.instruction).join(' ');
    if (/\d+°C internal|internal \d+°C|safe at an internal/.test(method)) {
      assert.match(method, /Health Canada/, `${id}: states a safe internal temperature with no authority named`);
    }
  }
});

test('the generated pages show each sourced record its source and access date, in both locales', () => {
  const r = localeBuild();
  for (const loc of LOCALES) {
    for (const id of EXPECTED_SOURCED_IDS) {
      const html = read(r, `${loc.prefix}recipes/${id}/index.html`);
      for (const source of baseItem(id).sources) {
        assert.ok(html.includes(source.url), `${loc.code}/${id}: the page does not show ${source.url}`);
      }
      assert.ok(html.includes('2026-09-14'), `${loc.code}/${id}: the page shows no access date`);
    }
  }
});

test('each record is marked with its own class, in each locale', () => {
  const r = localeBuild();
  const dicts = loadDictionaries();
  for (const loc of LOCALES) {
    const marks = {
      sourced: dicts.get(loc.code)['card.sourced'],
      'practical-note': dicts.get(loc.code)['card.practical'],
      fixture: dicts.get(loc.code)['card.fixture'],
    };
    // Three distinct words, or the mark tells a reader nothing.
    assert.equal(new Set(Object.values(marks)).size, 3,
      `${loc.code}: two of the three class marks are the same word`);

    for (const [cls, ids] of [
      ['sourced', EXPECTED_SOURCED_IDS],
      ['practical-note', EXPECTED_PRACTICAL_IDS],
      ['fixture', EXPECTED_FIXTURE_IDS],
    ]) {
      const others = Object.entries(marks).filter(([c]) => c !== cls).map(([, m]) => m);
      for (const id of ids) {
        const html = read(r, `${loc.prefix}recipes/${id}/index.html`);
        assert.ok(html.includes(`<span class="card__class">${esc(marks[cls])}</span>`),
          `${loc.code}/${id}: not marked "${marks[cls]}"`);
        for (const other of others) {
          assert.ok(!html.includes(`<span class="card__class">${esc(other)}</span>`),
            `${loc.code}/${id}: also marked "${other}"`);
        }
      }
    }
  }
});

// ======================================= the Quick Air-Fryer editorial section

test('the section is translated heading and intro only — membership never moves', () => {
  const collection = baseCollection();
  const overlay = loadOverlay('collections', 'zh', 'world-recipes');
  const zh = localizeCollection(collection, overlay, 'zh').record;

  assert.equal(collection.sections.length, 1);
  assert.equal(zh.sections.length, 1);
  const [en_, zh_] = [collection.sections[0], zh.sections[0]];

  assert.equal(zh_.section_id, QUICK_AIR_FRYER, 'a section_id must never be translated');
  assert.equal(zh_.section_id, en_.section_id);
  assert.deepEqual(zh_.item_ids, en_.item_ids, 'translation moved a record between sections');
  assert.deepEqual(zh_.item_ids, EXPECTED_PRACTICAL_IDS);

  for (const [field, english, localized] of [
    ['title', en_.title, zh_.title],
    ['intro', en_.intro, zh_.intro],
  ]) {
    assert.notEqual(localized, english, `section ${field} is still the English original`);
    assert.match(localized, HAN, `section ${field} was never written in Chinese`);
  }
  assert.equal(zh_.title, '快手空气炸锅');
  // The intro counts its own members; that number must survive translation.
  assert.deepEqual(numbersIn(zh_.intro), numbersIn(en_.intro), 'the section intro numbers drifted in zh');

  // An untranslated section falls back whole, and the base record is untouched.
  const none = localizeCollection(collection, { ...overlay, sections: {} }, 'zh').record;
  assert.deepEqual(none.sections[0], en_, 'a missing section translation must fall back to the English section');
  assert.deepEqual(baseCollection(), collection, 'localizing the collection mutated the base manifest');
});

/** The cards of a gallery page, keyed by item_id, in document order. */
function cardsOf(html) {
  const map = new Map();
  for (const block of html.match(/<li class="card"[\s\S]*?<\/li>/g) ?? []) {
    map.set(/data-item-id="([^"]+)"/.exec(block)[1], block);
  }
  return map;
}

test('each locale gallery renders its own lens heading, context, and affordance', () => {
  const r = localeBuild();
  const en_ = baseCollection().sections[0];
  const zh_ = loadOverlay('collections', 'zh', 'world-recipes').sections[QUICK_AIR_FRYER];
  const expected = { en: en_, zh: zh_ };
  const labels = {};

  for (const loc of LOCALES) {
    const gallery = read(r, `${loc.prefix}recipes/index.html`);
    const lenses = [...gallery.matchAll(/<section class="lens"[\s\S]*?<\/section>/g)].map((m) => m[0]);
    assert.equal(lenses.length, 1, `${loc.code}: the gallery should render one lens per declared section`);
    const html = lenses[0];

    assert.ok(html.includes(esc(expected[loc.code].title)), `${loc.code}: wrong lens title`);
    assert.ok(html.includes(esc(expected[loc.code].intro)), `${loc.code}: wrong lens context`);
    const foreign = loc.code === 'en' ? zh_ : en_;
    assert.ok(!html.includes(esc(foreign.intro)), `${loc.code}: the other locale's section intro leaked in`);

    // The affordance points at this locale's own catalogue, carries the
    // untranslated section_id, and is labelled in this locale's language.
    const action = /<a class="lens__action" href="([^"]+)" data-lens-filter="([^"]+)"[^>]*>([^<]*)<\/a>/.exec(html);
    assert.ok(action, `${loc.code}: the lens has no affordance`);
    const [href, target, label] = action.slice(1);
    assert.equal(target, QUICK_AIR_FRYER, 'a section_id must never be translated');
    assert.equal(href, `/${loc.prefix}recipes/?section=${QUICK_AIR_FRYER}#catalogue`,
      `${loc.code}: the affordance leaves this locale's page set`);
    assert.ok(existsSync(path.join(r.outDir, `${loc.prefix}recipes/index.html`)),
      `${loc.code}: the affordance has no page behind it`);
    assert.ok(gallery.includes('<form class="filters" id="catalogue"'),
      `${loc.code}: the catalogue has no fragment target`);
    labels[loc.code] = label;

    // The lens never lists its members: they exist once each, as cards.
    const cards = cardsOf(gallery);
    for (const id of EXPECTED_PRACTICAL_IDS) {
      assert.ok(!html.includes(id), `${loc.code}: the lens names ${id} instead of leaving it to the catalogue`);
      assert.ok(cards.has(id), `${loc.code}: ${id} lost its canonical card`);
      assert.equal([...gallery.matchAll(new RegExp(`data-item-id="${id}"`, 'g'))].length, 1,
        `${loc.code}: ${id} is rendered as more than one card`);
    }
    assert.equal(cards.size, EXPECTED_ITEM_IDS.length, `${loc.code}: the catalogue is not one card per record`);

    // Membership is marked on the cards, so the affordance targets all eight
    // members in this locale without depending on one word of the copy.
    const targeted = [...cards.entries()]
      .filter(([, block]) => (/data-sections="([^"]*)"/.exec(block)?.[1] ?? '').split(' ').includes(target))
      .map(([id]) => id);
    assert.deepEqual(targeted, EXPECTED_PRACTICAL_IDS,
      `${loc.code}: the affordance does not target exactly the eight section members`);
  }

  // The label is interface text, so each locale carries its own.
  assert.notEqual(labels.zh, labels.en, 'the zh lens affordance was never translated');
  assert.match(labels.zh, HAN, 'the zh lens affordance still reads as English');
  assert.doesNotMatch(labels.zh, /[A-Za-z]/, 'the zh lens affordance still carries English words');
  assert.match(labels.en, /8/, 'the en lens affordance does not say how many records it shows');
  assert.match(labels.zh, /8/, 'the zh lens affordance does not say how many records it shows');
});

test('the catalogue surfaces the vegetarian options in both locales', () => {
  const r = localeBuild();
  const VEGETARIAN = [
    'wr-airfryer-crispy-tofu',
    'wr-airfryer-broccoli-mixed-veg',
    'wr-airfryer-sweet-potato-wedges',
    'wr-airfryer-bean-cheese-quesadilla',
    'wr-airfryer-frozen-veg-dumplings',
  ];
  const enCards = cardsOf(read(r, 'recipes/index.html'));
  const zhCards = cardsOf(read(r, 'zh/recipes/index.html'));
  // The cuisine facet the card shows, which is the one a reader skims by.
  const cuisineOf = (block) => {
    const label = /<span class="card__meta">\s*<span>([^<]*)<\/span>/.exec(block);
    assert.ok(label, 'a card shows no cuisine label');
    return label[1];
  };

  for (const id of EXPECTED_PRACTICAL_IDS) {
    const vegetarian = VEGETARIAN.includes(id);
    assert.equal(/vegetarian/i.test(cuisineOf(enCards.get(id))), vegetarian,
      `en: ${id} is labelled wrongly on its card`);
    assert.equal(/素/.test(cuisineOf(zhCards.get(id))), vegetarian, `zh: ${id} is labelled wrongly on its card`);
  }
});

// ================================================ the browser-side switch

const APP_SRC = readFileSync(path.join(repoRoot, 'src', 'assets', 'app.js'), 'utf8');

class El {
  constructor(attrs = {}, children = []) {
    this.attrs = { ...attrs };
    this.children = children;
    this.listeners = new Map();
    this.hidden = false;
    this.textContent = '';
    this.focused = false;
  }

  getAttribute(name) {
    return Object.prototype.hasOwnProperty.call(this.attrs, name) ? this.attrs[name] : null;
  }

  setAttribute(name, value) { this.attrs[name] = String(value); }

  removeAttribute(name) { delete this.attrs[name]; }

  addEventListener(type, fn) {
    if (!this.listeners.has(type)) this.listeners.set(type, []);
    this.listeners.get(type).push(fn);
  }

  /** Fire a listener the way a browser would, with a minimal event object. */
  fire(type) {
    const event = { type, preventDefault() { this.defaultPrevented = true; }, defaultPrevented: false };
    for (const fn of this.listeners.get(type) ?? []) fn(event);
    return event;
  }

  descendants() {
    return this.children.flatMap((child) => [child, ...child.descendants()]);
  }

  matches(selector) {
    if (selector.startsWith('.')) {
      return (this.getAttribute('class') ?? '').split(/\s+/).includes(selector.slice(1));
    }
    const attr = /^\[([\w-]+)\]$/.exec(selector);
    return Boolean(attr) && this.getAttribute(attr[1]) !== null;
  }

  querySelectorAll(selector) { return this.descendants().filter((el) => el.matches(selector)); }

  querySelector(selector) { return this.querySelectorAll(selector)[0] ?? null; }

  focus() { this.focused = true; }
}

class Select extends El {
  constructor(attrs, options) {
    super(attrs);
    this.options = options;
    this._value = '';
  }

  get value() { return this._value; }

  set value(v) { this._value = String(v); }

  /** -1 for a value that is not one of the rendered options, as in a browser. */
  get selectedIndex() { return this.options.indexOf(this._value); }
}

/**
 * Build a page and run src/assets/app.js against it.
 *
 * @param {object} opts
 * @param {'en'|'zh'} opts.locale   which page set this page belongs to
 * @param {string}    opts.base     deployment base path
 * @param {string}    opts.route    build-relative route, e.g. "recipes/"
 * @param {string}    opts.search   initial query string, including "?"
 * @param {string}    opts.hash     initial fragment, including "#"
 * @param {'ok'|'refused'|'absent'|'unreadable'} opts.storage
 * @param {string|null} opts.stored persisted language preference
 * @param {boolean}   opts.filters  render the gallery filter controls
 * @param {boolean}   opts.lens     render a curated lens over two of the cards
 */
function runApp({
  locale = 'en', base = '/', route = 'recipes/', search = '', hash = '',
  storage = 'ok', stored = null, filters = true, switchBox = true, lens = true,
} = {}) {
  const key = LOCALE_STORAGE_KEY;
  const links = LOCALES.map((loc) => new El({
    href: `${base}${loc.prefix}${route}`,
    'data-locale-code': loc.code,
  }));
  const box = new El({
    'data-locale-switch': '',
    'data-locale-current': locale,
    'data-locale-key': key,
  }, links);

  const searchInput = new El({ 'data-search': '' });
  searchInput.value = '';
  const region = new Select({ 'data-region': '' }, ['', 'East Asia', 'Mediterranean', 'West Asia']);
  const status = new El({ 'data-status': '' });
  const reset = new El({ 'data-reset': '' });
  const form = new El({
    'data-filters': '',
    'data-status-all': 'Showing all {total} records.',
    'data-status-some': 'Showing {shown} of {total} records.',
    'data-status-none': 'No records match.',
  }, [searchInput, region, status, reset]);
  // Two of the three cards belong to a section, so a lens can be distinguished
  // from "everything" and from a single record.
  const cards = [
    new El({
      class: 'card', 'data-haystack': 'griddle flatbread west asia', 'data-region': 'West Asia',
      'data-sections': 'quick-things',
    }),
    new El({ class: 'card', 'data-haystack': 'rice porridge east asia', 'data-region': 'East Asia' }),
    new El({
      class: 'card', 'data-haystack': 'simmered bean soup mediterranean', 'data-region': 'Mediterranean',
      'data-sections': 'quick-things',
    }),
  ];
  const grid = new El({ 'data-grid': '' }, cards);
  const empty = new El({ 'data-empty': '' });
  const inlineReset = new El({ 'data-reset-inline': '' });
  const lensLink = new El({
    class: 'lens__action',
    'data-lens-filter': 'quick-things',
    href: `${base}${locale === 'en' ? '' : 'zh/'}recipes/?section=quick-things#catalogue`,
  });

  const root = new El({}, [
    ...(switchBox ? [box] : []),
    ...(lens ? [lensLink] : []),
    ...(filters ? [form, grid, empty, inlineReset] : []),
  ]);

  const store = new Map();
  if (stored !== null) store.set(key, stored);
  const localStorage = {
    getItem(name) {
      if (storage === 'unreadable') throw new Error('read denied');
      return store.has(name) ? store.get(name) : null;
    },
    setItem(name, value) {
      if (storage === 'refused' || storage === 'unreadable') throw new Error('write denied');
      store.set(name, String(value));
    },
    removeItem(name) {
      if (storage === 'refused') throw new Error('write denied');
      store.delete(name);
    },
  };

  const replaced = [];
  const pushed = [];
  const location = {
    pathname: `${base}${locale === 'en' ? '' : 'zh/'}${route}`,
    search,
    hash,
    replace(url) { replaced.push(url); },
  };
  const history = {
    replaceState(_state, _title, url) {
      pushed.push(url);
      let rest = String(url);
      const h = rest.indexOf('#');
      location.hash = h === -1 ? '' : rest.slice(h);
      if (h !== -1) rest = rest.slice(0, h);
      const q = rest.indexOf('?');
      location.search = q === -1 ? '' : rest.slice(q);
      if (q !== -1) rest = rest.slice(0, q);
      if (rest) location.pathname = rest;
    },
  };

  const window = { location, history, URLSearchParams };
  if (storage === 'absent') {
    Object.defineProperty(window, 'localStorage', {
      get() { throw new Error('localStorage is not available in this document'); },
    });
  } else {
    window.localStorage = localStorage;
  }

  const document = {
    querySelector: (sel) => root.querySelector(sel),
    querySelectorAll: (sel) => root.querySelectorAll(sel),
  };

  runInNewContext(APP_SRC, { window, document, URLSearchParams, console });

  const linkFor = (code) => links.find((l) => l.getAttribute('data-locale-code') === code);
  return {
    links, linkFor, box, form, search: searchInput, region, status, reset, grid, empty,
    inlineReset, cards, store, location, replaced, pushed, lensLink,
    shown: () => cards.filter((c) => !c.hidden).length,
    href: (code) => linkFor(code).getAttribute('href'),
    type(value) { searchInput.value = value; searchInput.fire('input'); },
    pick(value) { region.value = value; region.fire('change'); },
  };
}

test('the switch carries the live query and fragment, in both directions', () => {
  const en = runApp({ locale: 'en', search: '?q=rice&region=East+Asia', hash: '#main' });
  assert.equal(en.href('zh'), '/zh/recipes/?q=rice&region=East+Asia#main');
  assert.equal(en.href('en'), '/recipes/?q=rice&region=East+Asia#main');

  const zh = runApp({ locale: 'zh', search: '?q=rice&region=East+Asia', hash: '#main' });
  assert.equal(zh.href('en'), '/recipes/?q=rice&region=East+Asia#main');
  assert.equal(zh.href('zh'), '/zh/recipes/?q=rice&region=East+Asia#main');

  // Nothing to carry: the emitted href is left exactly as the page wrote it.
  const plain = runApp({ locale: 'en', route: '' });
  assert.equal(plain.href('zh'), '/zh/');
  assert.equal(plain.href('en'), '/');
});

test('choosing a language records the choice, in both directions', () => {
  const en = runApp({ locale: 'en' });
  en.linkFor('zh').fire('click');
  assert.equal(en.store.get(LOCALE_STORAGE_KEY), 'zh');
  assert.equal(en.replaced.length, 0, 'a click must navigate by following the link, not by scripted replace');

  const zh = runApp({ locale: 'zh', stored: 'zh' });
  zh.linkFor('en').fire('click');
  assert.equal(zh.store.get(LOCALE_STORAGE_KEY), 'en', 'switching back must overwrite the stored preference');
});

test('a refused, unreadable, or absent storage never breaks the switch', () => {
  for (const storage of ['refused', 'absent', 'unreadable']) {
    const page = runApp({ locale: 'en', storage, search: '?q=bean', hash: '#main', stored: 'zh' });
    assert.equal(page.href('zh'), '/zh/recipes/?q=bean#main', `${storage}: the switch stopped carrying state`);
    assert.doesNotThrow(() => page.linkFor('zh').fire('click'), `${storage}: a click threw`);
    assert.equal(page.replaced.length, 0, `${storage}: redirected on an unreadable preference`);
    if (storage !== 'absent') {
      assert.equal(page.store.get(LOCALE_STORAGE_KEY), storage === 'unreadable' ? 'zh' : 'zh',
        `${storage}: the preference must not be silently rewritten`);
    }
    // Filtering still works with no storage at all.
    page.type('bean');
    assert.equal(page.cards.filter((c) => !c.hidden).length, 1);
    assert.equal(page.href('zh'), '/zh/recipes/?q=bean#main');
  }
});

test('a stored preference redirects once, to a page-emitted href, and never loops', () => {
  const en = runApp({ locale: 'en', stored: 'zh', search: '?q=rice', hash: '#main' });
  assert.deepEqual(en.replaced, ['/zh/recipes/?q=rice#main']);

  const already = runApp({ locale: 'zh', stored: 'zh', search: '?q=rice' });
  assert.deepEqual(already.replaced, [], 'the target page must not redirect to itself');

  const back = runApp({ locale: 'zh', stored: 'en' });
  assert.deepEqual(back.replaced, ['/recipes/'], 'the preference must also send a reader back to English');

  for (const stored of ['fr', '', 'zh-hant']) {
    assert.deepEqual(runApp({ locale: 'en', stored }).replaced, [],
      `an unknown stored value ("${stored}") must not invent a route`);
  }

  const sub = runApp({ locale: 'en', base: '/library-preview/', stored: 'zh', search: '?region=East+Asia' });
  assert.deepEqual(sub.replaced, ['/library-preview/zh/recipes/?region=East+Asia'],
    'the redirect must stay under the configured base path');
});

test('filtering after load keeps the switch pointed at the current view', () => {
  const page = runApp({ locale: 'en' });
  assert.equal(page.href('zh'), '/zh/recipes/');

  page.type('bean');
  assert.equal(page.location.search, '?q=bean');
  assert.equal(page.href('zh'), '/zh/recipes/?q=bean',
    'the switch href was computed once at load and never followed the filter');

  page.pick('Mediterranean');
  assert.equal(page.href('zh'), '/zh/recipes/?q=bean&region=Mediterranean');

  page.type('');
  assert.equal(page.href('zh'), '/zh/recipes/?region=Mediterranean');

  page.reset.fire('click');
  assert.equal(page.location.search, '');
  assert.equal(page.href('zh'), '/zh/recipes/', 'clearing the filters must clear the carried query too');
  assert.equal(page.href('en'), '/recipes/');

  // And the href a click actually follows is the current one.
  page.type('rice');
  page.linkFor('zh').fire('click');
  assert.equal(page.href('zh'), '/zh/recipes/?q=rice');
});

test('the fragment survives filtering and a fragment set after load still travels', () => {
  const page = runApp({ locale: 'en', hash: '#main' });
  page.type('rice');
  assert.equal(page.pushed.at(-1), '?q=rice#main', 'the filter dropped the fragment from the URL');
  assert.equal(page.location.hash, '#main');
  assert.equal(page.href('zh'), '/zh/recipes/?q=rice#main');

  page.type('');
  assert.equal(page.pushed.at(-1), '/recipes/#main', 'clearing the query must not drop the fragment either');
  assert.equal(page.href('zh'), '/zh/recipes/#main');

  // A fragment the reader lands on later — an in-page anchor — is picked up at
  // click time rather than being frozen at load.
  const later = runApp({ locale: 'en' });
  later.location.hash = '#method';
  later.linkFor('zh').fire('click');
  assert.equal(later.href('zh'), '/zh/recipes/#method');
});

test('the switch works on a subpath deployment and on a page with no filters', () => {
  const sub = runApp({ locale: 'zh', base: '/library-preview/', route: 'recipes/wr-fixture-rice-porridge/', hash: '#method' });
  assert.equal(sub.href('en'), '/library-preview/recipes/wr-fixture-rice-porridge/#method');
  assert.equal(sub.href('zh'), '/library-preview/zh/recipes/wr-fixture-rice-porridge/#method');

  const detail = runApp({ locale: 'en', route: 'about/', filters: false, hash: '#main' });
  assert.equal(detail.href('zh'), '/zh/about/#main');
  detail.linkFor('zh').fire('click');
  assert.equal(detail.store.get(LOCALE_STORAGE_KEY), 'zh');

  // A page with filters but no switch must still filter, and must not throw.
  const noSwitch = runApp({ locale: 'en', switchBox: false });
  noSwitch.type('rice');
  assert.equal(noSwitch.cards.filter((c) => !c.hidden).length, 1);
  assert.equal(noSwitch.location.search, '?q=rice');
});

test('the filter reads the URL on load, and drops a region that is not on offer', () => {
  const page = runApp({ locale: 'zh', search: '?q=rice&region=East+Asia' });
  assert.equal(page.search.value, 'rice');
  assert.equal(page.region.value, 'East Asia');
  assert.equal(page.cards.filter((c) => !c.hidden).length, 1);
  assert.equal(page.status.textContent, 'Showing 1 of 3 records.');
  assert.equal(page.reset.hidden, false);

  const bogus = runApp({ locale: 'en', search: '?region=Atlantis' });
  assert.equal(bogus.region.value, '', 'a region that is not an option must not stay selected');
  assert.equal(bogus.cards.filter((c) => !c.hidden).length, 3);
  assert.equal(bogus.location.search, '', 'the bogus region must be dropped from the URL');
  assert.equal(bogus.href('zh'), '/zh/recipes/');

  const none = runApp({ locale: 'en', search: '?q=zzz' });
  assert.equal(none.status.textContent, 'No records match.');
  assert.equal(none.grid.hidden, true);
  assert.equal(none.empty.hidden, false);
  assert.equal(none.href('zh'), '/zh/recipes/?q=zzz');

  const all = runApp({ locale: 'en' });
  assert.equal(all.status.textContent, 'Showing all 3 records.');
  assert.equal(all.reset.hidden, true);
  assert.equal(all.empty.hidden, true);
});

test('a lens narrows the one catalogue instead of navigating to a second one', () => {
  const page = runApp({ locale: 'en' });
  assert.equal(page.shown(), 3);
  assert.equal(page.lensLink.getAttribute('aria-current'), null, 'no lens is active on an unfiltered view');

  const click = page.lensLink.fire('click');
  assert.equal(click.defaultPrevented, true, 'the lens should filter in place rather than reload the page');
  assert.equal(page.shown(), 2, 'the lens does not show exactly its own members');
  assert.equal(page.cards[1].hidden, true, 'a record outside the section stayed visible');
  assert.equal(page.location.search, '?section=quick-things', 'the lens state is not in the query string');
  assert.equal(page.status.textContent, 'Showing 2 of 3 records.');
  assert.equal(page.reset.hidden, false, 'a lens is a filter, so the reset control must be offered');
  assert.equal(page.lensLink.getAttribute('aria-current'), 'true', 'the active lens is not marked');

  // It composes with the other two filters rather than replacing them.
  page.type('bean');
  assert.equal(page.shown(), 1);
  assert.equal(page.location.search, '?q=bean&section=quick-things');
  page.pick('East Asia');
  assert.equal(page.shown(), 0, 'the three filters must intersect');
  assert.equal(page.empty.hidden, false);

  page.reset.fire('click');
  assert.equal(page.shown(), 3, 'reset must clear the lens along with the search and the region');
  assert.equal(page.location.search, '');
  assert.equal(page.lensLink.getAttribute('aria-current'), null, 'the cleared lens is still marked active');
});

test('a shared lens URL restores the view, and an unknown section is dropped', () => {
  const shared = runApp({ locale: 'zh', search: '?section=quick-things' });
  assert.equal(shared.shown(), 2, 'a shared lens link does not restore its view on load');
  assert.equal(shared.status.textContent, 'Showing 2 of 3 records.');
  assert.equal(shared.lensLink.getAttribute('aria-current'), 'true');
  // The lens travels with a language switch, the same way q and region do.
  assert.equal(shared.href('en'), '/recipes/?section=quick-things');

  const bogus = runApp({ locale: 'en', search: '?section=no-such-section' });
  assert.equal(bogus.shown(), 3, 'an unknown section must not hide every record');
  assert.equal(bogus.location.search, '', 'the unknown section must be dropped from the URL');
  assert.equal(bogus.lensLink.getAttribute('aria-current'), null);

  // A gallery with no lens at all still filters, and ignores a section query.
  const none = runApp({ locale: 'en', lens: false, search: '?section=quick-things&q=rice' });
  assert.equal(none.shown(), 1);
  assert.equal(none.location.search, '?q=rice');
});
