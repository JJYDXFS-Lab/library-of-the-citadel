// Checks for the Agent Nursery collection. Node standard library only — no
// dependency, nothing to install.
//
//   node --test tests/*.mjs
//
// What is protected here is different from what the other two shelves protect.
// A recipe is a structured record and a story is a block list the repository
// owns outright, but a handbook is a long authored manuscript that lives on
// disk as the authors' own Markdown file. So the thing that can go wrong is
// not a missing field — it is the published page drifting, quietly and by one
// line, away from the text the authors wrote and approved.
//
// Every assertion below is therefore anchored to one of two fixed points: the
// bytes of the manuscripts, written out here as digests so an edit to an
// author's text cannot pass unnoticed, and the spine the record declares, which
// is what makes an anchor mean the same place in both languages.

import test, { after } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync, existsSync, rmSync } from 'node:fs';
import { createHash } from 'node:crypto';
import path from 'node:path';

import { repoRoot, loadConfig } from '../src/config.mjs';
import { LOCALES, LOCALE_CODES, loadDictionaries } from '../src/i18n.mjs';
import { loadNursery, prefacePassage, NURSERY_ROUTE, handbookRoute } from '../src/nursery.mjs';
import { documentText } from '../src/markdown.mjs';
import { build } from '../src/build.mjs';
import { esc } from '../src/templates/pages.mjs';

// ------------------------------------------------------------- what is published

const COLLECTION_ID = 'agent-nursery';
const HANDBOOK_ID = 'agent-nursery-handbook';
const SOURCE_DIR = path.posix.join('sources', HANDBOOK_ID);

/** The two manuscripts, by the bytes they were published as. */
const MANUSCRIPTS = {
  zh: {
    file: `${SOURCE_DIR}/zh.md`,
    sha256: '89e8357276a85775bb87add6e35c1bc9c038c2cf7f14613ff5ed287a07ea9ecc',
    role: 'source',
    preface_marker: '## 作者序｜',
    // The Chinese preface is the passage JJYDXFS revised personally. It carries
    // its own digest so it cannot be re-drafted inside an otherwise valid edit.
    preface_sha256: 'db0a09984bebd3c464ecedadd17098bd6f66163f89e4b0e063d16ce4e1c6f261',
  },
  en: {
    file: `${SOURCE_DIR}/en.md`,
    sha256: 'd4d3e190f665da11a23066e00dfc8f6521d2d54d8f7e2866b2827b9c485512cf',
    role: 'translation',
    preface_marker: '## Authors’ Preface | ',
    preface_sha256: '09db1f7e0ed8bb4232cde4edf75e65c12b4dd0745e28f79cd0a5b7c1a92961b8',
  },
};

/** The declared spine, by kind. The reader's anchors are these ids. */
const SPINE = {
  chapters: 8,
  exercises: 3,
  appendices: 2,
  sections: [
    'preface', 'where-we-begin',
    'chapter-1', 'chapter-2', 'chapter-3', 'chapter-4',
    'chapter-5', 'chapter-6', 'chapter-7', 'chapter-8',
    'appendix-exercises', 'appendix-agreements', 'revision-notes',
  ],
  subsections: { 'appendix-exercises': ['exercise-a', 'exercise-b', 'exercise-c'] },
};

const HANDBOOK_ROUTE = `${NURSERY_ROUTE}handbook/`;
const RIGHTS_HOLDERS = ['JJYDXFS', 'Atom (原子)'];
const NURSERY_DIR = path.join(repoRoot, 'content', COLLECTION_ID);

const sha256 = (buffer) => createHash('sha256').update(buffer).digest('hex');

const loaded = () => {
  const result = loadNursery();
  assert.deepEqual(result.errors, [], `Agent Nursery validation reported problems:\n  - ${result.errors.join('\n  - ')}`);
  return result;
};

/** The one published handbook, with its record and its two manuscripts. */
function handbook() {
  const { collection, handbooks, manuscripts } = loaded();
  assert.deepEqual(collection.handbook_ids, [HANDBOOK_ID], 'the manifest does not publish exactly the released handbook');
  assert.deepEqual(handbooks.map((h) => h.handbook_id), [HANDBOOK_ID], 'the tree holds a handbook the manifest does not publish');
  return { collection, record: handbooks[0], manuscripts: manuscripts.get(HANDBOOK_ID) };
}

// --------------------------------------------------------------- the builds

function walk(dir, base = dir) {
  const out = [];
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) out.push(...walk(full, base));
    else out.push(path.relative(base, full));
  }
  return out.sort();
}

const OUT_DIRS = ['dist-test-nursery-root', 'dist-test-nursery-pages'];
function cleanTestOutputs() {
  for (const name of OUT_DIRS) rmSync(path.join(repoRoot, name), { recursive: true, force: true });
}
after(cleanTestOutputs);
process.on('exit', cleanTestOutputs);

const builds = new Map();
function buildOnce(key, env) {
  if (!builds.has(key)) builds.set(key, build(env));
  return builds.get(key);
}
// The root deployment, and the project-subpath deployment GitHub Pages serves.
const rootBuild = () => buildOnce('root', { LIBRARY_OUT_DIR: OUT_DIRS[0] });
const pagesBuild = () => buildOnce('pages', {
  LIBRARY_BASE_PATH: '/library-of-the-citadel/',
  LIBRARY_OUT_DIR: OUT_DIRS[1],
});
const DEPLOYMENTS = () => [['root', rootBuild(), '/'], ['pages', pagesBuild(), '/library-of-the-citadel/']];

const read = (r, rel) => readFileSync(path.join(r.outDir, rel), 'utf8');
const pageAt = (loc, rel) => `${loc.prefix}${rel}`;

// ============================================== the manuscripts, byte for byte

test('the manuscripts on disk are exactly the bytes the record publishes', () => {
  const { record, manuscripts } = handbook();

  assert.deepEqual(readdirSync(path.join(NURSERY_DIR, 'sources', HANDBOOK_ID)).sort(), ['en.md', 'zh.md'],
    'content/agent-nursery/sources/ does not hold exactly the two published manuscripts');

  for (const code of LOCALE_CODES) {
    const expected = MANUSCRIPTS[code];
    const entry = record.manuscripts[code];
    const where = `${HANDBOOK_ID} (${code})`;

    // The record points at the released file, under sources/ and nowhere else.
    assert.equal(entry.file, expected.file, `${where}: the record points at a different manuscript`);
    assert.equal(entry.manuscript_role, expected.role, `${where}: the manuscript changed role`);

    // The bytes on disk, the digest the record declares, and the digest written
    // down here are all the same thing. Any edit to an author's text moves all
    // three apart until someone states that it happened.
    const bytes = readFileSync(path.join(NURSERY_DIR, entry.file));
    assert.equal(sha256(bytes), expected.sha256, `${where}: the manuscript is not the published text`);
    assert.equal(entry.sha256, expected.sha256, `${where}: the record declares a digest that is not the published one`);
    assert.equal(entry.bytes, bytes.length, `${where}: the record declares ${entry.bytes} bytes but the file is ${bytes.length}`);
    assert.equal(manuscripts.get(code).sha256, expected.sha256, `${where}: the loader read a different file`);
  }

  // Exactly one edition is the manuscript the authors wrote first.
  assert.equal(LOCALE_CODES.filter((c) => record.manuscripts[c].manuscript_role === 'source').length, 1,
    'exactly one manuscript is the source edition; the other is a translation of it');
});

test('the approved preface passage is published exactly as it was approved', () => {
  const { record, manuscripts } = handbook();

  for (const code of LOCALE_CODES) {
    const expected = MANUSCRIPTS[code];
    const entry = record.manuscripts[code];
    const where = `${HANDBOOK_ID} (${code})`;
    assert.equal(entry.preface_marker, expected.preface_marker, `${where}: the preface marker moved`);

    // The passage is taken from the raw manuscript between the marker and the
    // next "## " heading, so the digest is over the bytes the authors wrote
    // rather than over anything this build derived from them.
    const passage = prefacePassage(manuscripts.get(code).text, entry.preface_marker);
    assert.ok(passage && passage.trim(), `${where}: the preface passage is empty or the marker does not occur`);
    assert.ok(!passage.includes('\n## '), `${where}: the preface passage runs past the next section`);
    assert.equal(sha256(Buffer.from(passage, 'utf8')), expected.preface_sha256,
      `${where}: the approved preface is not the passage published here`);
    assert.equal(entry.preface_sha256, expected.preface_sha256, `${where}: the record declares an unapproved preface digest`);
  }
});

// ===================================================== the manuscript, rendered

/** The reading column of a handbook page, as plain lines. */
function renderedManuscript(html) {
  const article = /<article class="handbook">([\s\S]*?)<\/article>/.exec(html);
  assert.ok(article, 'the page has no handbook');
  return article[1]
    // The page furniture around the authors' text: the marks and the abstract
    // the record supplies, the contents list, and the publication colophon.
    // What is left is the manuscript and nothing else.
    .replace(/<p class="handbook__marks">[\s\S]*?<\/p>/, '')
    .replace(/<p class="handbook__abstract">[\s\S]*?<\/p>/, '')
    .replace(/<nav class="handbook-contents"[\s\S]*?<\/nav>/, '')
    .replace(/<section class="record__block record__block--provenance"[\s\S]*?<\/section>/, '')
    // Inline markup does not break a line: the authors' emphasis and their own
    // language links sit inside a line of prose, not beside it.
    .replace(/<\/?strong>/g, '')
    .replace(/<\/?a\b[^>]*>/g, '')
    .replace(/<br>/g, '\n')
    .replace(/<[^>]*>/g, '\n')
    .replace(/&lt;/g, '<').replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"').replace(/&#39;/g, "'")
    .replace(/&amp;/g, '&')
    .split('\n').map((line) => line.trim()).filter(Boolean);
}

test('every handbook page renders the whole manuscript, line for line, in both locales and at either base path', () => {
  const { manuscripts } = handbook();

  for (const [label, r] of DEPLOYMENTS().map(([l, b]) => [l, b])) {
    for (const loc of LOCALES) {
      const expected = documentText(manuscripts.get(loc.code).blocks).map((line) => line.trim()).filter(Boolean);
      // A floor, so a parse that silently returned almost nothing could not
      // make the comparison below pass by matching an empty page.
      assert.ok(expected.length > 60, `${loc.code}: the parsed manuscript is implausibly short (${expected.length} lines)`);
      assert.deepEqual(renderedManuscript(read(r, pageAt(loc, `${HANDBOOK_ROUTE}index.html`))), expected,
        `${label}/${loc.code}: the rendered handbook is not the manuscript, line for line`);
    }
  }
});

test('the handbook is published with its declared spine, and both languages anchor it the same way', () => {
  const { record } = handbook();
  const { structure } = record;

  // The counts the pages advertise are the sections the spine actually lists.
  assert.equal(structure.chapter_count, SPINE.chapters);
  assert.equal(structure.exercise_count, SPINE.exercises);
  assert.equal(structure.appendix_count, SPINE.appendices);
  assert.deepEqual(structure.sections.map((s) => s.section_id), SPINE.sections, 'the declared spine changed');
  assert.equal(structure.sections.filter((s) => s.kind === 'chapter').length, SPINE.chapters);
  assert.equal(structure.sections.filter((s) => s.kind === 'appendix').length, SPINE.appendices);
  for (const [parent, subs] of Object.entries(SPINE.subsections)) {
    const section = structure.sections.find((s) => s.section_id === parent);
    assert.deepEqual((section.subsections ?? []).map((s) => s.section_id), subs, `${parent}: the exercises moved`);
  }

  const allIds = SPINE.sections.flatMap((id) => [id, ...(SPINE.subsections[id] ?? [])]);
  for (const [label, r] of DEPLOYMENTS().map(([l, b]) => [l, b])) {
    for (const loc of LOCALES) {
      const html = read(r, pageAt(loc, `${HANDBOOK_ROUTE}index.html`));
      // The anchors are the declared ids, so a link to #chapter-3 means the same
      // place in either language — that is what carries a reader's place across
      // the language switch in a document this long.
      const anchored = [...html.matchAll(/<section class="handbook__section[^"]*" id="([^"]+)"/g)].map((m) => m[1]);
      assert.deepEqual(anchored, allIds, `${label}/${loc.code}: the rendered sections are not the declared spine`);
      // And the contents list offers every one of them, and nothing else.
      const contents = /<nav class="handbook-contents"[\s\S]*?<\/nav>/.exec(html);
      assert.ok(contents, `${label}/${loc.code}: the handbook has no contents list`);
      assert.deepEqual([...contents[0].matchAll(/href="#([^"]+)"/g)].map((m) => m[1]), allIds,
        `${label}/${loc.code}: the contents list does not lead to every declared section`);
      // Each heading is the manuscript's own, not an id dressed up as a title.
      for (const id of allIds) {
        assert.match(html, new RegExp(`id="h-${id}" class="handbook__heading">[^<]`),
          `${label}/${loc.code}: section "${id}" has no heading from the manuscript`);
      }
    }
  }
});

// ================================================ the routes, and the way back

test('the collection emits exactly its four pages, navigable in both locales and at either base path', () => {
  for (const [label, r, base] of DEPLOYMENTS()) {
    assert.equal(r.handbookCount, 1, `${label}: the build reports a handbook count the collection cannot show`);

    const routes = walk(r.outDir).filter((rel) => rel.split(path.sep).join('/').includes(`collections/${COLLECTION_ID}/`));
    assert.deepEqual(routes.map((rel) => rel.split(path.sep).join('/')).sort(), [
      `${NURSERY_ROUTE}handbook/index.html`,
      `${NURSERY_ROUTE}index.html`,
      `zh/${NURSERY_ROUTE}handbook/index.html`,
      `zh/${NURSERY_ROUTE}index.html`,
    ].sort(), `${label}: the collection emits something other than its landing page and its one handbook, per locale`);

    for (const loc of LOCALES) {
      // Both pages mark the collection as the section the reader is in.
      for (const rel of [`${NURSERY_ROUTE}index.html`, `${HANDBOOK_ROUTE}index.html`]) {
        const html = read(r, pageAt(loc, rel));
        assert.ok(html.includes(`<a href="${base}${loc.prefix}${NURSERY_ROUTE}" aria-current="page"`),
          `${label}/${loc.code}/${rel}: the collection is not the current nav item`);
      }
      // The handbook's one way off the page is back to the collection.
      const reader = read(r, pageAt(loc, `${HANDBOOK_ROUTE}index.html`));
      const nav = /<nav class="story-nav"[\s\S]*?<\/nav>/.exec(reader);
      assert.ok(nav, `${label}/${loc.code}: the handbook has no return navigation`);
      assert.ok(nav[0].includes(`<a class="story-nav__index" href="${base}${loc.prefix}${NURSERY_ROUTE}">`),
        `${label}/${loc.code}: the return link does not point at the collection`);
      assert.equal([...nav[0].matchAll(/<a /g)].length, 1,
        `${label}/${loc.code}: the return rail invents a next chapter instead of one way back`);
    }

    // Switching language keeps the route, both ways, on both pages.
    for (const route of [NURSERY_ROUTE, HANDBOOK_ROUTE]) {
      const hrefOf = (html, code) => new RegExp(`<a href="([^"]+)"[^>]*data-locale-code="${code}"`).exec(html)?.[1];
      const en = read(r, `${route}index.html`);
      const zh = read(r, `zh/${route}index.html`);
      assert.equal(hrefOf(en, 'zh'), `${base}zh/${route}`, `${label}: en ${route} does not switch to the same zh route`);
      assert.equal(hrefOf(zh, 'en'), `${base}${route}`, `${label}: zh ${route} does not switch back to the same en route`);
    }
  }
});

test('both pages carry the required footer credit, and the manuscript closes by naming its holders', () => {
  const cfg = loadConfig({});
  const REQUIRED = '© 2026 JJYDXFS & Atom (原子). All rights reserved.';
  const { record } = handbook();
  assert.deepEqual(record.rights.holders, RIGHTS_HOLDERS, 'the handbook\'s rights holders moved');

  for (const [label, r] of DEPLOYMENTS().map(([l, b]) => [l, b])) {
    for (const loc of LOCALES) {
      for (const rel of [`${NURSERY_ROUTE}index.html`, `${HANDBOOK_ROUTE}index.html`]) {
        const html = read(r, pageAt(loc, rel));
        const line = /<p class="colophon__copyright">([\s\S]*?)<\/p>/.exec(html);
        assert.ok(line, `${label}/${loc.code}/${rel}: no copyright line`);
        assert.equal(line[1].replace(/<[^>]*>/g, '').replace(/&amp;/g, '&'), REQUIRED,
          `${label}/${loc.code}/${rel}: the visible credit is not the required line`);
        for (const [name, url] of Object.entries(cfg.copyright.links)) {
          assert.ok(line[1].includes(`<a href="${url}">${esc(name)}</a>`), `${label}/${loc.code}/${rel}: ${name} is not linked to ${url}`);
        }
      }

      // The manuscript's own closing line is the authors' text, and it is the
      // one place inside it where the holders are linked to their addresses.
      const closing = /<p class="handbook__closing">([\s\S]*?)<\/p>/.exec(read(r, pageAt(loc, `${HANDBOOK_ROUTE}index.html`)));
      assert.ok(closing, `${label}/${loc.code}: the handbook does not end on its copyright line`);
      assert.equal(closing[1].replace(/<[^>]*>/g, '').replace(/&amp;/g, '&'),
        record.manuscripts[loc.code].copyright_line,
        `${label}/${loc.code}: the closing line is not the one the manuscript ends on`);
      for (const { name, url } of record.holder_links.filter((h) => closing[1].includes(esc(h.name)))) {
        assert.ok(closing[1].includes(`<a href="${url}">${esc(name)}</a>`),
          `${label}/${loc.code}: the closing line does not link ${name}`);
      }
      assert.equal([...closing[1].matchAll(/<a /g)].length, RIGHTS_HOLDERS.length,
        `${label}/${loc.code}: the closing line links something other than its two holders`);
    }
  }
});

// The acceptance bug this pins: the four nursery pages used to end on the
// recipe build's colophon, which talks about cooking facts, food-safety review
// and the deployment's base path — none of which is true of a manuscript. They
// carry their own compact footer now, and the copyright is the last thing a
// reader sees on the page.
test('neither nursery page inherits the recipe colophon, and each ends on the copyright', () => {
  const footerOf = (html) => /<footer class="colophon[^"]*">([\s\S]*?)<\/footer>/.exec(html);
  // Whole paragraphs of the shared footer, taken from a page that still has it,
  // so this test keeps working when that footer's wording changes.
  const parasOf = (block) => [...block.matchAll(/<p\b[^>]*>[\s\S]*?<\/p>/g)].map((m) => m[0]);

  for (const [label, r, base] of DEPLOYMENTS()) {
    for (const loc of LOCALES) {
      const generic = footerOf(read(r, pageAt(loc, 'recipes/index.html')));
      assert.ok(generic, `${label}/${loc.code}: the recipe gallery lost its colophon`);
      const inherited = parasOf(generic[1]).filter((p) => !p.includes('colophon__copyright')
        && !p.includes('colophon__development'));
      assert.ok(inherited.length >= 3, `${label}/${loc.code}: the shared colophon no longer has prose to compare against`);

      for (const rel of [`${NURSERY_ROUTE}index.html`, `${HANDBOOK_ROUTE}index.html`]) {
        const where = `${label}/${loc.code}/${rel}`;
        const html = read(r, pageAt(loc, rel));

        for (const para of inherited) {
          assert.ok(!html.includes(para), `${where}: inherits a paragraph of the recipe colophon`);
        }
        // Named outright, so a reworded shared footer cannot smuggle these back.
        assert.doesNotMatch(html, /cooking facts|food-safety|烹饪事实|食品安全/,
          `${where}: carries the recipe build's cooking prose`);
        assert.ok(!html.includes('colophon__meta'), `${where}: carries the base-path metadata line`);
        assert.doesNotMatch(html, /Served from base path|从基路径/, `${where}: states the deployment's base path`);

        const footer = footerOf(html);
        assert.ok(footer, `${where}: no colophon at all`);
        assert.ok(footer[0].startsWith('<footer class="colophon colophon--nursery">'),
          `${where}: the nursery colophon is not the collection's own`);
        // One practical note, in this locale and not the other one.
        assert.match(footer[1], /<p class="colophon__living">\S[\s\S]*?<\/p>/, `${where}: no living-document note`);
        const foreignNote = esc(loadDictionaries().get(LOCALE_CODES.find((c) => c !== loc.code))['nursery.footer_note']);
        assert.ok(!html.includes(foreignNote), `${where}: shows the other locale's footer note`);
        // The copyright is the last visible line: the final paragraph of the
        // footer, and the footer is the last thing before the shared script.
        const paras = parasOf(footer[1]);
        assert.match(paras.at(-1), /^<p class="colophon__copyright">/, `${where}: the copyright is not the last visible line`);
        assert.equal(html.slice(html.indexOf(footer[0]) + footer[0].length).trim(),
          `<script src="${base}assets/app.js" defer></script>\n</body>\n</html>`,
          `${where}: something other than the shared script follows the colophon`);
        // That script is what drives the language switch, so it must survive.
        assert.ok(html.includes('data-locale-switch'), `${where}: no language switch to script`);
      }
    }
  }
});

test('the collection is reachable from the hall and carries no operational path', () => {
  const { collection } = handbook();

  for (const [label, r, base] of DEPLOYMENTS()) {
    for (const loc of LOCALES) {
      // The hall opens the collection beside the other two rooms, and the
      // landing page opens the one artifact published in it.
      const hall = read(r, pageAt(loc, 'index.html'));
      assert.ok(hall.includes(`class="shelf__link" href="${base}${loc.prefix}${NURSERY_ROUTE}"`),
        `${label}/${loc.code}: the hall does not open Agent Nursery`);
      const landing = read(r, pageAt(loc, `${NURSERY_ROUTE}index.html`));
      assert.ok(landing.includes(`class="holding__link" href="${base}${loc.prefix}${HANDBOOK_ROUTE}"`),
        `${label}/${loc.code}: the landing page does not open the published handbook`);
      assert.equal([...landing.matchAll(/<li class="holding">/g)].length, 1,
        `${label}/${loc.code}: the landing page shows a different number of artifacts than it publishes`);
      // The project states a goal; it may not state it as a going concern.
      assert.match(landing, /has not been established|尚未成立/,
        `${label}/${loc.code}: the landing page does not say where the institution currently stands`);
    }
  }

  // Patterns that would mean this collection had been published straight out of
  // a working directory: a local absolute path, a run receipt, a harness name.
  const FORBIDDEN = [
    /\.agent-office-runs/i, /\.agent-runs/i, /worker-report/i, /agent-harness/i,
    /\/Users\//, /\/home\/[a-z]/i, /run[-_]receipt/i, /transcript/i, /OpenClawShare/i,
  ];
  const targets = [
    path.join(NURSERY_DIR, 'collection.json'),
    path.join(NURSERY_DIR, 'handbooks', `${HANDBOOK_ID}.json`),
    ...Object.values(MANUSCRIPTS).map((m) => path.join(NURSERY_DIR, m.file)),
    path.join(repoRoot, 'src', 'nursery.mjs'),
    path.join(repoRoot, 'src', 'markdown.mjs'),
    path.join(repoRoot, 'src', 'templates', 'nursery.mjs'),
  ];
  for (const r of [rootBuild(), pagesBuild()]) {
    for (const rel of walk(r.outDir)) {
      const posix = rel.split(path.sep).join('/');
      if (posix.includes(`collections/${COLLECTION_ID}/`) || posix === `data/${COLLECTION_ID}.json`) {
        targets.push(path.join(r.outDir, rel));
      }
    }
  }
  assert.ok(targets.length > 10, 'the leak scan found almost nothing to scan');
  for (const file of targets) {
    assert.ok(existsSync(file), `${path.relative(repoRoot, file)} is missing`);
    const body = readFileSync(file, 'utf8');
    for (const pattern of FORBIDDEN) {
      assert.doesNotMatch(body, pattern, `${path.relative(repoRoot, file)} matches ${pattern}`);
    }
  }

  // The data export is the same collection, in manifest order.
  const data = JSON.parse(read(rootBuild(), `data/${COLLECTION_ID}.json`));
  assert.equal(data.collection.collection_id, COLLECTION_ID);
  assert.deepEqual(data.handbooks.map((h) => h.handbook_id), collection.handbook_ids);
  assert.equal(handbookRoute(data.handbooks[0]), HANDBOOK_ROUTE);
});
