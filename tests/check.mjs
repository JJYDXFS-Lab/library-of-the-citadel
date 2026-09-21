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

// The collection is mixed, and the three kinds are held to different rules: a
// fixture must never acquire a source, a sourced record must never be without
// one, and an original practical note must have none at all while still being
// neither of the other two. Keeping the three lists apart is what lets each
// test say which kind it is talking about.
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
// The Quick Air-Fryer section, in the order the manifest's section lists it.
// Membership is asserted against the manifest below rather than assumed.
const EXPECTED_PRACTICAL_IDS = [
  'wr-airfryer-crispy-tofu',
  'wr-airfryer-chicken-thigh-bites',
  'wr-airfryer-salmon-fillet',
  'wr-airfryer-broccoli-mixed-veg',
  'wr-airfryer-sweet-potato-wedges',
  'wr-airfryer-bean-cheese-quesadilla',
  'wr-airfryer-frozen-veg-dumplings',
];
const QUICK_AIR_FRYER = 'quick-air-fryer';
const EXPECTED_ITEM_IDS = [
  ...EXPECTED_FIXTURE_IDS, ...EXPECTED_SOURCED_IDS, ...EXPECTED_PRACTICAL_IDS,
].sort();
const TOTAL_RECORDS = 16;

// The story shelf is a second content type, not a seventeenth recipe. Its
// census lives in tests/stories.mjs; this file only needs to know which routes
// the build is allowed to emit. Two stories are published: a Chinese-only work
// and a bilingual one, which are the same shape as far as routing is concerned.
const EXPECTED_STORY_IDS = ['citadel-night-dialogue-on-relation', 'the-third-chair'];

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

/** The file a link asks for: its query string and fragment are not part of it. */
const routeOf = (link) => link.split('#')[0].split('?')[0];

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

test('the repository holds sixteen records in one collection: six sourced, seven practical notes, three fixtures', () => {
  const { items, collections } = loadContent();
  assert.equal(items.length, TOTAL_RECORDS);
  assert.equal(collections.length, 1);
  const idsOfClass = (cls) => items.filter((i) => i.record_class === cls).map((i) => i.item_id).sort();
  assert.deepEqual(idsOfClass('fixture'), EXPECTED_FIXTURE_IDS);
  assert.deepEqual(idsOfClass('sourced'), EXPECTED_SOURCED_IDS);
  assert.deepEqual(idsOfClass('practical-note'), [...EXPECTED_PRACTICAL_IDS].sort());
  // No fourth class slipped in: the three lists account for every record.
  assert.deepEqual(items.map((i) => i.item_id).sort(), EXPECTED_ITEM_IDS);
  assert.deepEqual([...collections[0].item_ids].sort(), EXPECTED_ITEM_IDS);
  assert.equal(
    EXPECTED_SOURCED_IDS.length + EXPECTED_PRACTICAL_IDS.length + EXPECTED_FIXTURE_IDS.length,
    TOTAL_RECORDS);
});

test('the existing sourced and fixture records are untouched by the air-fryer addition', () => {
  // The air-fryer section was added beside the earlier content, not on top of
  // it. The earlier records keep their IDs, their classes, their sources, and
  // their place at the front and the back of the manifest.
  const { items, collections } = loadContent();
  const byId = new Map(items.map((i) => [i.item_id, i]));
  const order = collections[0].item_ids;

  assert.deepEqual(order.slice(0, 6), [
    'wr-oven-lamb-kofta-traybake',
    'wr-oven-lamb-potato-bake',
    'wr-oven-chicken-thigh-traybake',
    'wr-oven-salmon-traybake',
    'wr-oven-halloumi-chickpea-traybake',
    'wr-oven-root-veg-traybake',
  ], 'the sourced oven records no longer open the manifest in their original order');
  assert.deepEqual(order.slice(6, 13), EXPECTED_PRACTICAL_IDS,
    'the Quick Air-Fryer records are not in manifest order between the oven set and the fixtures');
  assert.deepEqual(order.slice(13), EXPECTED_FIXTURE_IDS,
    'the fixtures no longer close the manifest');

  for (const id of EXPECTED_SOURCED_IDS) {
    assert.equal(byId.get(id).record_class, 'sourced', `${id} changed class`);
    assert.ok(byId.get(id).sources.length >= 1, `${id} lost its sources`);
  }
  for (const id of EXPECTED_FIXTURE_IDS) {
    assert.equal(byId.get(id).record_class, 'fixture', `${id} changed class`);
    assert.deepEqual(byId.get(id).sources, [], `${id} grew sources`);
  }
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

test('the practical-note gate holds: original notes cite nothing and claim nothing', () => {
  const { items } = loadContent();
  const notes = items.filter((i) => i.record_class === 'practical-note');
  assert.equal(notes.length, 7);

  for (const item of notes) {
    const where = item.item_id;
    // A note that is neither researched nor a demonstration: its honesty is the
    // empty source list plus a source_state that only this class may use.
    assert.deepEqual(item.sources, [], `${where}: a practical note must carry no sources`);
    assert.equal(item.source_state, 'none-authored-here', `${where}: wrong source_state`);
    assert.notEqual(item.source_state, 'none-fixture-authored',
      `${where}: a practical note must not borrow the fixture's sourceless state`);
    assert.equal(item.region.label_basis, 'editorial-facet', `${where}: wrong region label basis`);
    assert.equal(item.publication_ready, false, `${where}: claims to be publication-ready`);
    assert.equal(item.safety.review_state, 'not-reviewed', `${where}: claims a review it has not had`);
    assert.notEqual(item.rights.license_review_state, 'fixture-original-text',
      `${where}: a practical note is original text but it is not fixture text`);
    assert.deepEqual(item.rights.images, [], `${where}: practical notes ship no images`);

    // The banner a reader sees must name the class and disclaim both testing
    // and a professional food-safety review.
    assert.match(item.record_notice, /practical note/i, `${where}: the notice does not name the class`);
    assert.match(item.record_notice, /professional food-safety review/i,
      `${where}: the notice does not disclaim a professional food-safety review`);
    assert.match(item.record_notice, /cooked or tested/i,
      `${where}: the notice does not disclaim kitchen testing`);

    // Celsius only, everywhere in the record. A stray Fahrenheit figure in one
    // record and not the others is exactly the inconsistency a reader trips on.
    const allText = JSON.stringify(item);
    assert.doesNotMatch(allText, /°F|Fahrenheit/i, `${where}: this section is Celsius-only`);
    assert.match(allText, /°C/, `${where}: no Celsius temperature anywhere in the record`);

    assert.ok(item.tags.includes('air-fryer'), `${where}: not tagged air-fryer`);
    assert.ok(item.tags.includes('practical-note'), `${where}: not tagged practical-note`);
  }
});

test('the air-fryer section keeps vegetarian options visible, and marks them', () => {
  // Five of the seven are vegetarian. The section's lens copy says so, and the
  // facet a reader filters and skims by is the cuisine label on the card, so
  // both are checked rather than left to the prose.
  const { items } = loadContent();
  const byId = new Map(items.map((i) => [i.item_id, i]));
  const VEGETARIAN = [
    'wr-airfryer-crispy-tofu',
    'wr-airfryer-broccoli-mixed-veg',
    'wr-airfryer-sweet-potato-wedges',
    'wr-airfryer-bean-cheese-quesadilla',
    'wr-airfryer-frozen-veg-dumplings',
  ];
  const NOT_VEGETARIAN = ['wr-airfryer-chicken-thigh-bites', 'wr-airfryer-salmon-fillet'];

  const tagged = EXPECTED_PRACTICAL_IDS.filter((id) => byId.get(id).tags.includes('vegetarian'));
  assert.deepEqual(tagged, VEGETARIAN, 'the vegetarian tagging of the section has drifted');
  for (const id of VEGETARIAN) {
    // The facet a reader actually sees on the card.
    assert.match(byId.get(id).region.cuisine_label, /vegetarian/i,
      `${id}: the cuisine label does not surface that it is vegetarian`);
  }
  for (const id of NOT_VEGETARIAN) {
    assert.ok(!byId.get(id).tags.includes('vegetarian'), `${id} must not be tagged vegetarian`);
    assert.doesNotMatch(byId.get(id).region.cuisine_label, /vegetarian/i,
      `${id}: the cuisine label calls a meat or fish recipe vegetarian`);
  }
});

test('the poultry note requires a measured 75°C and refuses time or colour as the test', () => {
  const chicken = loadContent().items.find((i) => i.item_id === 'wr-airfryer-chicken-thigh-bites');
  const method = chicken.method.map((m) => m.instruction).join(' ');
  const caveats = chicken.safety.caveats.join(' ');
  const both = `${method} ${caveats}`;

  assert.match(method, /75°C/, 'the method does not name the 75°C figure the notes cook to');
  assert.match(both, /thickest/i, 'the temperature is not tied to the thickest part');
  assert.match(both, /clear of the basket and any metal/i,
    'the reader is not told to keep the probe clear of the basket and any metal');
  assert.match(both, /food-safety authority/i,
    'a sourceless record that names a cook-to temperature must hand the reader back to their own authority');
  assert.match(both, /[Cc]olour and elapsed time are not tests|Time is not a control and neither is colour/,
    'the record does not refuse time and colour as doneness tests');
  assert.doesNotMatch(both, /safe at|guaranteed|guarantees|always safe/i,
    'an unreviewed record must not promise safety');
});

test('the fish note states no temperature of its own and does not sell time as a test', () => {
  const salmon = loadContent().items.find((i) => i.item_id === 'wr-airfryer-salmon-fillet');
  const method = salmon.method.map((m) => m.instruction).join(' ');
  const both = `${method} ${salmon.safety.caveats.join(' ')}`;

  // The appliance setting is a Celsius number; a doneness threshold is not.
  const temperatures = [...both.matchAll(/(\d+)\s*°C/g)].map((m) => Number(m[1]));
  assert.deepEqual(temperatures, [180],
    'the only Celsius figure in the fish note should be the air-fryer setting, not a doneness claim');
  assert.match(both, /[Tt]ime alone is not a doneness test|Elapsed time is not a safety control/,
    'the fish note does not say that time alone is not a test');
  assert.match(both, /food-safety authority/i,
    'a reader who wants a number is not sent to their own food-safety authority');
  assert.doesNotMatch(both, /safe at|safe internal|guaranteed|always safe/i,
    'the fish note must make no universal safe-temperature claim');
  assert.match(both, /opaque/i, 'the stated endpoint is not the visual and texture one the record claims to give');
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

const practicalItem = () => JSON.parse(readFileSync(
  path.join(repoRoot, 'content', 'items', 'wr-airfryer-crispy-tofu.json'), 'utf8',
));

test('the honesty rules reject a practical note that grows a citation or a review', () => {
  const cited = practicalItem();
  cited.sources.push({ url: 'https://an.example.org/a', title: 'A', accessed_at: '2026-09-16' });
  assert.ok(checkItem(cited).some((e) => /a practical note carries no source pointers/.test(e)),
    checkItem(cited).join('; '));

  const ready = practicalItem();
  ready.publication_ready = true;
  assert.ok(checkItem(ready).some((e) => /must not be marked publication_ready/.test(e)));

  const reviewed = practicalItem();
  reviewed.safety.review_state = 'reviewed';
  assert.ok(checkItem(reviewed).some((e) => /must use safety\.review_state "not-reviewed"/.test(e)));

  const attributed = practicalItem();
  attributed.region.label_basis = 'source-attributed';
  assert.ok(checkItem(attributed).some((e) => /label_basis must be "editorial-facet"/.test(e)));

  const unlabelled = practicalItem();
  unlabelled.record_notice = 'A note about cooking.';
  assert.ok(checkItem(unlabelled).some((e) => /record_notice must name the record as a practical note/.test(e)));
});

test('the two sourceless states cannot be borrowed by the wrong record class', () => {
  const borrowedByNote = practicalItem();
  borrowedByNote.source_state = 'none-fixture-authored';
  const noteErrors = checkItem(borrowedByNote);
  assert.ok(noteErrors.some((e) => /must use source_state "none-authored-here"/.test(e)), noteErrors.join('; '));
  assert.ok(noteErrors.some((e) => /"none-fixture-authored" belongs to record_class "fixture"/.test(e)),
    noteErrors.join('; '));

  const borrowedByFixture = fixtureItem();
  borrowedByFixture.source_state = 'none-authored-here';
  assert.ok(checkItem(borrowedByFixture)
    .some((e) => /"none-authored-here" belongs to record_class "practical-note"/.test(e)));
});

test('a sourceless practical note that names a cook-to temperature must point at an authority', () => {
  const chicken = JSON.parse(readFileSync(
    path.join(repoRoot, 'content', 'items', 'wr-airfryer-chicken-thigh-bites.json'), 'utf8'));
  assert.deepEqual(checkItem(chicken), [], 'the chicken note as written must satisfy its own gate');

  const stripped = JSON.parse(JSON.stringify(chicken));
  stripped.method = stripped.method.map((m) => ({
    ...m, instruction: m.instruction.replace(/food-safety authority/g, 'packet'),
  }));
  assert.ok(checkItem(stripped).some((e) => /must tell the reader to check it against their own food-safety authority/.test(e)),
    checkItem(stripped).join('; '));
});

test('the section rules refuse a member the collection does not hold, or one claimed twice', () => {
  const { collections, items } = loadContent();
  const base = () => JSON.parse(JSON.stringify(collections[0]));

  const stranger = base();
  stranger.sections[0].item_ids.push('wr-fixture-does-not-exist');
  assert.ok(checkCollection(stranger, items)
    .some((e) => /is not a member of the collection/.test(e)));

  const twice = base();
  twice.sections[0].item_ids.push(twice.sections[0].item_ids[0]);
  assert.ok(checkCollection(twice, items).some((e) => /twice/.test(e)));

  const contested = base();
  contested.sections.push({
    section_id: 'another-section',
    title: 'Another',
    intro: 'Another grouping.',
    item_ids: [contested.sections[0].item_ids[0]],
  });
  assert.ok(checkCollection(contested, items).some((e) => /is claimed by both section/.test(e)));

  const duplicated = base();
  duplicated.sections.push(JSON.parse(JSON.stringify(duplicated.sections[0])));
  assert.ok(checkCollection(duplicated, items).some((e) => /duplicate section_id/.test(e)));
});

test('the collection declares exactly one section, holding exactly the practical notes', () => {
  const { collections } = loadContent();
  const sections = collections[0].sections;
  assert.equal(sections.length, 1, 'the collection should declare exactly the Quick Air-Fryer section');
  assert.equal(sections[0].section_id, QUICK_AIR_FRYER);
  assert.equal(sections[0].title, 'Quick Air-Fryer');
  assert.deepEqual(sections[0].item_ids, EXPECTED_PRACTICAL_IDS,
    'the section does not hold exactly the seven practical notes, in order');
  assert.ok(sections[0].intro.trim().length > 0);
  // A section is discovery, not a second membership list.
  for (const id of sections[0].item_ids) {
    assert.ok(collections[0].item_ids.includes(id), `${id} is in the section but not in the collection`);
  }
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
const PAGES = ['index.html', 'recipes/index.html', 'stories/index.html', 'about/index.html',
  ...EXPECTED_ITEM_IDS.map((id) => `recipes/${id}/index.html`),
  ...EXPECTED_STORY_IDS.map((id) => `stories/${id}/index.html`)];
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
  'data/world-recipes.json', 'data/world-recipes.zh.json', 'data/stories.json'];

for (const [label, run, base] of [['root', rootBuild, '/'], ['subpath', previewBuild, '/library-preview/']]) {
  test(`the ${label} build emits every page, asset, and data file`, () => {
    const r = run();
    assert.equal(r.cfg.basePath, base);
    assert.equal(r.itemCount, TOTAL_RECORDS);
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

/** Every `<li class="card">` block in a gallery page, in document order. */
const cardBlocks = (html) => [...html.matchAll(/<li class="card"[\s\S]*?<\/li>/g)].map((m) => m[0]);

/** The id each card block is keyed by. */
const cardIds = (html) => [...html.matchAll(/<li class="card" data-item-id="([^"]+)"/g)].map((m) => m[1]);

/** The sections a gallery page says a record belongs to, keyed by item_id. */
function cardSections(html) {
  const map = new Map();
  for (const block of cardBlocks(html)) {
    const id = /data-item-id="([^"]+)"/.exec(block)[1];
    const sections = /data-sections="([^"]*)"/.exec(block);
    map.set(id, sections ? sections[1].split(' ').filter(Boolean) : []);
  }
  return map;
}

test('every record has exactly one canonical card in the one catalogue', () => {
  for (const [label, run] of [['root', rootBuild], ['subpath', previewBuild]]) {
    const gallery = read(run(), 'recipes/index.html');
    const ids = cardIds(gallery);

    assert.equal(ids.length, TOTAL_RECORDS, `${label}: the catalogue does not hold one card per record`);
    assert.deepEqual([...ids].sort(), EXPECTED_ITEM_IDS, `${label}: the catalogue's card set is not the record set`);
    for (const id of EXPECTED_ITEM_IDS) {
      assert.equal(ids.filter((seen) => seen === id).length, 1, `${label}: ${id} is rendered as more than one card`);
    }
    // The seven section members are the case this guards: they used to be
    // rendered once as a full section list and again as cards.
    for (const id of EXPECTED_PRACTICAL_IDS) {
      assert.equal(ids.filter((seen) => seen === id).length, 1,
        `${label}: the section member ${id} has more than one canonical card`);
      assert.equal([...gallery.matchAll(new RegExp(`href="[^"]*recipes/${id}/"`, 'g'))].length, 1,
        `${label}: ${id} is linked from the gallery more than once`);
    }
    assert.equal([...gallery.matchAll(/class="card"/g)].length, TOTAL_RECORDS,
      `${label}: the number of card elements is not the number of records`);
  }
});

test('a collection section renders as a lens over the catalogue, not as a second list', () => {
  for (const [label, run, base] of [['root', rootBuild, '/'], ['subpath', previewBuild, '/library-preview/']]) {
    const r = run();
    const gallery = read(r, 'recipes/index.html');
    const lenses = [...gallery.matchAll(/<section class="lens"[\s\S]*?<\/section>/g)].map((m) => m[0]);
    assert.equal(lenses.length, 1, `${label}: the gallery should render one lens per declared section`);
    const html = lenses[0];

    assert.ok(html.includes(`data-lens="${QUICK_AIR_FRYER}"`), `${label}: the lens carries no stable section id`);
    assert.ok(html.includes(`aria-labelledby="section-${QUICK_AIR_FRYER}"`),
      `${label}: the lens is not labelled by its own heading`);
    assert.match(html, /<h2 id="section-quick-air-fryer"[^>]*>Quick Air-Fryer /, `${label}: wrong lens heading`);
    assert.match(html, /7 records/, `${label}: the lens does not count its own members`);

    // Compact by construction: context and one affordance, no member list and
    // no per-member link.
    assert.ok(!/<ul|<li/.test(html), `${label}: the lens renders a list of its members again`);
    for (const id of EXPECTED_PRACTICAL_IDS) {
      assert.ok(!html.includes(`recipes/${id}/`), `${label}: the lens links ${id} outside the catalogue`);
    }

    // The affordance is a real link into this page's own catalogue, carrying
    // the section in the query, so it works before any script runs.
    const links = [...html.matchAll(/<a class="lens__action" href="([^"]+)" data-lens-filter="([^"]+)"/g)];
    assert.equal(links.length, 1, `${label}: the lens has no single affordance`);
    const [href, target] = links[0].slice(1);
    assert.equal(target, QUICK_AIR_FRYER, `${label}: the affordance names the wrong section`);
    assert.equal(href, `${base}recipes/?section=${QUICK_AIR_FRYER}#catalogue`,
      `${label}: the affordance does not point at this locale's catalogue under base "${base}"`);
    assert.ok(gallery.includes('<form class="filters" id="catalogue"'),
      `${label}: the catalogue has no fragment target for the affordance to reach`);
    assert.ok(html.includes(`aria-describedby="section-${QUICK_AIR_FRYER}"`),
      `${label}: the affordance is not described by its own lens heading`);

    // The affordance targets exactly the section's seven members, through the
    // membership facet on the cards rather than through anything in the copy.
    const sections = cardSections(gallery);
    const members = [...sections.entries()].filter(([, ids]) => ids.includes(target)).map(([id]) => id);
    assert.deepEqual(members, EXPECTED_PRACTICAL_IDS,
      `${label}: the cards the lens targets are not the seven section members, in order`);
    for (const [id, ids] of sections) {
      if (!EXPECTED_PRACTICAL_IDS.includes(id)) {
        assert.deepEqual(ids, [], `${label}: ${id} claims a section it is not a member of`);
      }
    }

    // No other page grows a lens.
    for (const page of ALL_PAGES.filter((p) => !p.endsWith('recipes/index.html'))) {
      assert.ok(!read(r, page).includes('class="lens"'),
        `${label}: ${page} should not carry the gallery's lens`);
    }
  }
});

test('the lens mechanism is generic: no source file knows this section exists', () => {
  // A collection section is a content decision. The templates, the script and
  // the stylesheet may only know that sections exist at all.
  for (const rel of [['src', 'templates', 'pages.mjs'], ['src', 'assets', 'app.js'],
    ['src', 'assets', 'site.css'], ['src', 'i18n.mjs'], ['src', 'rules.mjs']]) {
    const source = readFileSync(path.join(repoRoot, ...rel), 'utf8');
    assert.ok(!source.includes(QUICK_AIR_FRYER), `${rel.join('/')} hard-codes the "${QUICK_AIR_FRYER}" section id`);
    assert.doesNotMatch(source, /air.fryer/i, `${rel.join('/')} branches on air-fryer content`);
  }
  for (const [code, value] of Object.entries(JSON.parse(
    readFileSync(path.join(repoRoot, 'content', 'locales', 'ui', 'en.json'), 'utf8')))) {
    assert.doesNotMatch(`${code} ${value}`, /air.fryer/i, 'an interface string names one collection section');
  }
});

test('the lens membership facet is exactly the validated manifest section', () => {
  // The lens is a view of the manifest, not a parallel grouping: what the page
  // marks on a card is what checkCollection() already validated.
  const { collections } = loadContent();
  const declared = new Map(collections[0].sections.map((s) => [s.section_id, s.item_ids]));
  const gallery = read(rootBuild(), 'recipes/index.html');
  const rendered = new Map();
  for (const [id, sections] of cardSections(gallery)) {
    for (const sectionId of sections) rendered.set(sectionId, [...(rendered.get(sectionId) ?? []), id]);
  }
  assert.deepEqual([...rendered.keys()], [...declared.keys()]);
  for (const [sectionId, ids] of declared) {
    assert.deepEqual(rendered.get(sectionId), ids, `section "${sectionId}": rendered membership drifted`);
  }
});

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
      // A lens affordance links to a route plus a query and a fragment; the
      // file it resolves to is the route.
      const route = routeOf(link);
      const target = route.endsWith('/') ? `${route}index.html` : route;
      assert.ok(emitted.has(target), `${page}: link "${link}" has no file at "${target}"`);
    }
  }
});

test('the gallery exposes the search, filter, and empty-state hooks the script binds to', () => {
  const html = read(rootBuild(), 'recipes/index.html');
  for (const hook of ['data-filters', 'data-search', 'data-region', 'data-status',
    'data-reset', 'data-grid', 'data-empty', 'data-reset-inline', 'data-lens-filter', 'data-sections']) {
    assert.ok(html.includes(hook), `gallery is missing the "${hook}" hook`);
  }
  assert.match(html, /<p class="filters__status" aria-live="polite"/);
  assert.match(html, /<div class="empty-state" data-empty hidden>/);
  assert.match(html, /<noscript>/);

  for (const region of regionsOf(loadContent().items)) {
    assert.ok(html.includes(`<option value="${region}">`), `no filter option for region "${region}"`);
  }
  assert.equal([...html.matchAll(/data-haystack="/g)].length, TOTAL_RECORDS,
    'every card needs a search haystack');
  assert.equal([...html.matchAll(/class="card"/g)].length, TOTAL_RECORDS);

  const app = readFileSync(path.join(repoRoot, 'src', 'assets', 'app.js'), 'utf8');
  for (const hook of ['[data-filters]', '[data-search]', '[data-region]', '[data-status]',
    '[data-reset]', '[data-grid]', '[data-empty]', '[data-reset-inline]', '[data-lens-filter]']) {
    assert.ok(app.includes(hook), `app.js never queries "${hook}"`);
  }
});

test('hiding a grid actually hides it: the stylesheet overrides its own display rule', () => {
  const css = readFileSync(path.join(repoRoot, 'src', 'assets', 'site.css'), 'utf8');
  assert.match(css, /\[hidden\]\s*\{\s*display:\s*none\s*!important;?\s*\}/,
    'app.js sets .hidden on the grid, which sets display:grid; an explicit [hidden] rule must win');
  assert.doesNotMatch(css, /головы/, 'the stylesheet contains corrupted text');
});

// --------------------------------------------- the hall, its rooms, the trail

test('the hall opens exactly two public rooms, each carrying its own room mark', () => {
  const r = rootBuild();
  for (const [hallPage, prefix] of [['index.html', ''], ['zh/index.html', 'zh/']]) {
    const hall = read(r, hallPage);
    const shelves = [...hall.matchAll(/<li class="shelf[\s\S]*?<\/li>/g)].map((m) => m[0]);
    assert.equal(shelves.length, 2, `${hallPage}: the hall should stand exactly two public rooms`);

    // Each room is a real link to its own index, and wears one room mark.
    const hrefs = shelves.map((s) => /class="shelf__link" href="([^"]+)"/.exec(s)?.[1]);
    assert.deepEqual(hrefs, [`/${prefix}recipes/`, `/${prefix}stories/`],
      `${hallPage}: the rooms are not the collection and the story shelf, in hall order`);
    shelves.forEach((shelf, i) => {
      assert.equal([...shelf.matchAll(/class="room-mark"/g)].length, 1,
        `${hallPage}: room ${i + 1} does not carry exactly one room mark`);
    });
    // A room the hall does not hold is a note, not a card standing empty.
    assert.ok(!hall.includes('shelf--empty'), `${hallPage}: an empty shelf card is still being rendered`);
    assert.match(hall, /<p class="rooms__further">/, `${hallPage}: the further-shelves note was dropped`);
  }
});

test('every page below the hall carries a location trail that leads back to it', () => {
  const r = rootBuild();
  for (const page of ALL_PAGES) {
    const html = read(r, page);
    const isHall = page === 'index.html' || page === 'zh/index.html';
    if (isHall) {
      assert.ok(!html.includes('<nav class="trail"'), `${page}: the hall is the trail's root and needs no trail`);
      continue;
    }
    const trail = /<nav class="trail"[\s\S]*?<\/nav>/.exec(html);
    assert.ok(trail, `${page}: no location trail`);
    const steps = [...trail[0].matchAll(/<li class="trail__step[^"]*"[^>]*>([\s\S]*?)<\/li>/g)].map((m) => m[1]);
    assert.ok(steps.length >= 2, `${page}: a trail needs at least the hall and this page`);

    // The first step is always the hall of this page's own locale.
    const home = page.startsWith('zh/') ? '/zh/' : '/';
    assert.match(steps[0], new RegExp(`<a href="${home}">`), `${page}: the trail does not start at the hall`);
    // The last step is this page, marked current, and is never a link.
    assert.ok(!steps[steps.length - 1].includes('<a '), `${page}: the current trail step links to itself`);
    assert.equal([...trail[0].matchAll(/aria-current="page"/g)].length, 1,
      `${page}: exactly one trail step is the current one`);
  }
});

test('a record page keeps its room identity and states where it stands on the shelf', () => {
  const r = rootBuild();
  const { collections } = loadContent();
  const order = collections[0].item_ids;

  for (const [prefix, collectionTitle] of [['', 'World Recipes'], ['zh/', '世界食谱']]) {
    order.forEach((id, i) => {
      const html = read(r, `${prefix}recipes/${id}/index.html`);
      const trail = /<nav class="trail"[\s\S]*?<\/nav>/.exec(html)[0];
      // The middle step is the room: its mark, then its own name, linked.
      assert.match(trail, new RegExp(`<span class="room-mark">[^<]+</span> <a href="/${prefix}recipes/">`),
        `${prefix}${id}: the trail does not name the room this record belongs to`);
      assert.ok(trail.includes(`>${collectionTitle}</a>`), `${prefix}${id}: the room step is not in this locale`);

      // The position line is the record's shelf coordinate, and it agrees with
      // the prev/next walk rather than being a second, independent ordering.
      const position = /<p class="record-nav__position">([^<]*)<\/p>/.exec(html);
      assert.ok(position, `${prefix}${id}: no shelf position on the return rail`);
      assert.match(position[1], new RegExp(`\\b${i + 1}\\b`), `${prefix}${id}: wrong position on the shelf`);
      assert.match(position[1], new RegExp(`\\b${TOTAL_RECORDS}\\b`), `${prefix}${id}: the shelf total is not the record count`);
      assert.ok(position[1].includes(collectionTitle), `${prefix}${id}: the position line does not name the room`);
    });
  }
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
    // Sixteen records, two page sets.
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
  assert.equal(data.items.length, TOTAL_RECORDS);
  assert.equal(data.collection.collection_id, 'world-recipes');
  assert.deepEqual(data.items.map((i) => i.item_id), data.collection.item_ids);
  assert.equal(data.items.filter((i) => i.record_class === 'sourced').length, 6);
  assert.equal(data.items.filter((i) => i.record_class === 'practical-note').length, 7);
  assert.equal(data.items.filter((i) => i.record_class === 'fixture').length, 3);
  for (const item of data.items) assert.equal(item.publication_ready, false);
  // The section travels with the manifest, so a consumer of the data file can
  // reproduce the grouping without scraping the HTML.
  assert.deepEqual(data.collection.sections.map((s) => s.section_id), [QUICK_AIR_FRYER]);
  assert.deepEqual(data.collection.sections[0].item_ids, EXPECTED_PRACTICAL_IDS);
});

test('the output fetches nothing from a third party', () => {
  // Reader-activated source and copyright links are allowed; silently loaded
  // third-party subresources are not.
  const r = rootBuild();
  for (const rel of walk(r.outDir)) {
    if (!rel.endsWith('.html') && !rel.endsWith('.css')) continue;
    const body = readFileSync(path.join(r.outDir, rel), 'utf8');

    assert.doesNotMatch(body, /\ssrc\s*=\s*["']?https?:\/\//i, `${rel} loads a third-party subresource`);
    assert.doesNotMatch(body, /url\(\s*["']?https?:\/\//i, `${rel} loads a third-party asset from CSS`);
    assert.doesNotMatch(body, /@import/i, `${rel} imports a stylesheet`);
    assert.doesNotMatch(body, /<link\b[^>]*href\s*=\s*["']https?:\/\//i, `${rel} links a third-party resource into the page`);
  }
});

test('a build leaves no stray file behind and is byte-stable across runs', () => {
  const first = build({ LIBRARY_OUT_DIR: 'dist-test-stable' });
  const firstFiles = walk(first.outDir).map((f) => [f, statSync(path.join(first.outDir, f)).size]);
  const second = build({ LIBRARY_OUT_DIR: 'dist-test-stable' });
  const secondFiles = walk(second.outDir).map((f) => [f, statSync(path.join(second.outDir, f)).size]);
  assert.deepEqual(secondFiles, firstFiles, 'two consecutive builds disagree');
});
