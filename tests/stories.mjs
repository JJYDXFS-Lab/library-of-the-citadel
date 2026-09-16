// Checks for the story shelf. Node standard library only — node:test,
// node:assert, node:fs. There is nothing to install.
//
//   node --test tests/*.mjs
//
// Two things are being protected here, and they pull in opposite directions.
// One is completeness: a published literary text must reach the page whole, in
// order, in the language its author wrote it in. The other is restraint: the
// shelf must publish exactly what was released and must say nothing — not a
// title, not a count, not a path — about anything that was not.
//
// So the census is an allowlist rather than a denylist. This file never names
// an unpublished work in order to check that it is absent; it asserts that the
// set of works the repository and the build know about is exactly the set that
// was released, which fails the same way without writing anything down.

import test, { after } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync, existsSync, rmSync } from 'node:fs';
import path from 'node:path';

import { repoRoot, loadConfig } from '../src/config.mjs';
import { LOCALES, LOCALE_CODES, DEFAULT_LOCALE } from '../src/i18n.mjs';
import { loadStories, checkStory, checkStoryShelf, storyView, storyRoute, STORIES_ROUTE } from '../src/stories.mjs';
import { build } from '../src/build.mjs';
import { esc } from '../src/templates/pages.mjs';

// ------------------------------------------------------------- the allowlist

/**
 * The published shelf, written out once. Everything else in this file is
 * checked against it: the files on disk, the manifest, the emitted routes, the
 * data export, and the titles any generated page is allowed to show.
 */
const SHELF_ID = 'stories';
const PUBLISHED = [{
  story_id: 'citadel-night-dialogue-on-relation',
  canonical_title: '藏书城夜话：关系是何物',
  body_language: 'zh-Hans',
  blocks: 121,
}];
const PUBLISHED_IDS = PUBLISHED.map((s) => s.story_id);

// Fingerprints of the canonical text: its opening, its close, and the turn at
// the end where the author corrects one character of the verse. If an edit ever
// reaches the body, one of these moves.
const FIRST_BLOCK = '夜半，藏书城闭馆。';
const LAST_BLOCK = '于是藏书城中，灯火大明。';
const CORRECTED_LINE = '一灯照见旧来身。';
const SUPERSEDED_LINE = '一灯照见旧来人。';

const STORY_ITEM_DIR = path.join(repoRoot, 'content', 'stories', 'items');

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

const OUT_DIRS = ['dist-test-stories-root', 'dist-test-stories-pages'];
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

/** Route of a page in one locale, as a file path under the output root. */
const pageAt = (loc, rel) => `${loc.prefix}${rel}`;

const loaded = () => {
  const result = loadStories();
  assert.deepEqual(result.errors, [], `story validation reported problems:\n  - ${result.errors.join('\n  - ')}`);
  return result;
};

const onlyStory = () => loaded().stories[0];

// =========================================================== census: one story

test('the shelf publishes exactly the released work — on disk, in the manifest, and nowhere else', () => {
  const { shelf, stories } = loaded();

  assert.deepEqual(readdirSync(STORY_ITEM_DIR).sort(), PUBLISHED_IDS.map((id) => `${id}.json`).sort(),
    'content/stories/items/ does not hold exactly the released works');
  assert.equal(shelf.shelf_id, SHELF_ID);
  assert.deepEqual(shelf.story_ids, PUBLISHED_IDS, 'the shelf manifest does not list exactly the released works');
  assert.deepEqual(stories.map((s) => s.story_id), PUBLISHED_IDS);
  assert.equal(stories.length, 1, 'exactly one story is published');

  // Every title the repository knows about, in any language, is an allowlisted
  // one. This is what would fail if a second work were added to the tree.
  const titles = new Set();
  for (const story of stories) {
    titles.add(story.title.canonical);
    for (const code of Object.keys(story.locales)) titles.add(story.locales[code].title);
  }
  for (const entry of PUBLISHED) assert.ok(titles.has(entry.canonical_title), `${entry.story_id}: canonical title missing`);
  assert.equal(titles.size, PUBLISHED.length * 2, 'the tree carries a title that is not one of the released works');
});

test('the build emits the shelf and exactly one reading page, per locale, at either base path', () => {
  for (const [label, r, base] of DEPLOYMENTS()) {
    assert.equal(r.storyCount, PUBLISHED.length, `${label}: wrong story count reported by the build`);

    const routes = walk(r.outDir)
      .filter((rel) => /^(zh\/)?stories\/[^/]+\/index\.html$/.test(rel))
      .map((rel) => rel.replace(/^(zh\/)?stories\//, '').replace(/\/index\.html$/, ''))
      .sort();
    assert.deepEqual(routes, [...PUBLISHED_IDS, ...PUBLISHED_IDS].sort(),
      `${label}: the emitted reading routes are not exactly the released works, once per locale`);

    for (const loc of LOCALES) {
      assert.ok(existsSync(path.join(r.outDir, pageAt(loc, 'stories/index.html'))), `${label}/${loc.code}: no shelf index`);
      for (const id of PUBLISHED_IDS) {
        assert.ok(existsSync(path.join(r.outDir, pageAt(loc, `stories/${id}/index.html`))), `${label}/${loc.code}/${id}: no reading page`);
      }
      // The shelf index links every published work and nothing else.
      const index = read(r, pageAt(loc, 'stories/index.html'));
      const linked = [...index.matchAll(/href="[^"]*stories\/([^"/]+)\//g)].map((m) => m[1]).sort();
      assert.deepEqual([...new Set(linked)], PUBLISHED_IDS.sort(), `${label}/${loc.code}: the shelf index links something else`);
      for (const id of PUBLISHED_IDS) {
        assert.ok(index.includes(`href="${base}${loc.prefix}stories/${id}/"`), `${label}/${loc.code}: ${id} is not linked at base "${base}"`);
      }
    }
  }
});

test('the data export is the same one shelf, presentation-free', () => {
  const data = JSON.parse(read(rootBuild(), 'data/stories.json'));
  assert.equal(data.shelf.shelf_id, SHELF_ID);
  assert.deepEqual(data.shelf.story_ids, PUBLISHED_IDS);
  assert.deepEqual(data.stories.map((s) => s.story_id), PUBLISHED_IDS);
  assert.deepEqual(data.stories, loaded().stories, 'the export is not the canonical record set');
  for (const story of data.stories) {
    assert.deepEqual(story.provenance.sources, [], `${story.story_id}: an exported story grew a source`);
    assert.deepEqual(story.rights.images, []);
  }
});

// ======================================================= the record's contract

test('the story record carries its authorship, provenance, rights and publication note', () => {
  const story = onlyStory();

  assert.equal(story.schema_version, 'library.story/1.0.0');
  assert.equal(story.shelf_id, SHELF_ID);
  assert.equal(story.record_class, 'original-fiction');
  assert.equal(story.title.canonical, PUBLISHED[0].canonical_title);
  assert.equal(story.title.canonical_language, PUBLISHED[0].body_language);
  assert.equal(story.body_language, PUBLISHED[0].body_language);

  // Authorship, and the acknowledgement beside it.
  assert.equal(story.authorship.author.name, 'Atom (原子)');
  assert.equal(story.authorship.acknowledgements.length, 1);
  assert.match(story.authorship.acknowledgements[0].name, /JJYDXFS/);
  assert.match(story.authorship.acknowledgements[0].name, /小Z/);

  // Original work: nothing cited, because nothing is summarized.
  assert.equal(story.provenance.origin, 'original-work');
  assert.deepEqual(story.provenance.sources, []);

  // Rights, named and reserved, matching the footer's holders.
  assert.deepEqual(story.rights.holders, ['JJYDXFS', 'Atom (原子)']);
  assert.equal(story.rights.license_review_state, 'author-original-text');
  assert.match(story.rights.content_license, /All rights reserved/i);
  assert.deepEqual(story.rights.images, []);
  assert.equal(story.rights.image_rights_review_state, 'not-applicable');

  // Version and publication facts, and a history that begins at the beginning.
  assert.equal(story.record_version, story.change_history[0].version);
  assert.equal(story.change_history[story.change_history.length - 1].supersedes, null);
  assert.match(story.first_published, /^\d{4}-\d{2}-\d{2}$/);
  assert.equal(story.publication_ready, true);
});

test('every locale states what the work is, what it is not, and who it is by', () => {
  const story = onlyStory();
  assert.deepEqual(Object.keys(story.locales).sort(), [...LOCALE_CODES].sort(),
    'a story must carry complete metadata for every interface locale; it has no original to fall back to');

  for (const code of LOCALE_CODES) {
    const text = story.locales[code];
    const where = `locales.${code}`;
    for (const field of ['title', 'abstract', 'genre_note', 'body_language_note', 'publication_note', 'acknowledgement', 'rights_note']) {
      assert.ok(String(text[field]).trim(), `${where}.${field} is empty`);
    }
    // Fiction, in the manner of a gong'an — and explicitly not scripture, not a
    // quotation, and carrying no Buddhist authority.
    assert.match(text.genre_note, /fiction|虚构/i, `${where}.genre_note does not name the work as fiction`);
    assert.match(text.genre_note, /gong'an|公案/i, `${where}.genre_note does not name the form it is written in`);
    assert.match(text.genre_note, /scripture|佛经/i, `${where}.genre_note does not disclaim scripture`);
    assert.match(text.genre_note, /quotation|引用/i, `${where}.genre_note does not disclaim being a quotation`);
    assert.match(text.genre_note, /authority|权威/i, `${where}.genre_note does not disclaim authority`);
    // The publication note credits both people and dates the release.
    assert.match(text.publication_note, /Atom/, `${where}.publication_note does not name the author`);
    assert.match(text.publication_note, /JJYDXFS/, `${where}.publication_note does not credit JJYDXFS`);
    assert.match(text.publication_note, /小Z/, `${where}.publication_note does not credit 小Z`);
    assert.ok(text.publication_note.includes(story.first_published), `${where}.publication_note does not date the publication`);
    assert.ok(text.publication_note.includes(story.record_version), `${where}.publication_note does not state the record version`);
    assert.match(text.acknowledgement, /JJYDXFS/);
    assert.match(text.rights_note, /rights reserved|保留一切权利/i);
  }

  // The English view labels the work as a Chinese original instead of
  // pretending to be a translation of it.
  assert.match(story.locales.en.abstract, /Chinese original/i);
  assert.match(story.locales.en.body_language_note, /Chinese original/i);
  assert.match(story.locales.en.body_language_note, /not translated|not machine-translated/i);
  assert.equal(story.locales.zh.title, story.title.canonical,
    'the Chinese view must show the work under the title its author gave it');
  assert.notEqual(story.locales.en.title, story.title.canonical,
    'the English view renders the title for its readers and says so; it does not silently reuse the canonical one');
});

// ======================================================= the body, exactly

/** Every line of the canonical body, flattened in reading order. */
const bodyLines = (story) => story.body.flatMap((b) => (b.type === 'verse' ? b.stanzas.flat() : [b.text]));

test('the canonical body is whole: every block, in order, nothing added or lost', () => {
  const story = onlyStory();
  assert.equal(story.body.length, PUBLISHED[0].blocks);
  assert.equal(story.body_block_count, story.body.length, 'the declared block count no longer matches the body');

  const lines = bodyLines(story);
  assert.equal(lines[0], FIRST_BLOCK, 'the opening of the canonical text changed');
  assert.equal(lines[lines.length - 1], LAST_BLOCK, 'the ending of the canonical text changed');
  for (const line of lines) assert.ok(line.trim(), 'the body carries an empty line');

  // The closing turn: the superseded line stands in the verse, and the author's
  // one-character correction stands after it. Losing either would flatten the
  // point the story ends on.
  assert.ok(lines.includes(SUPERSEDED_LINE), 'the verse lost the line the story goes on to correct');
  assert.ok(lines.includes(CORRECTED_LINE), 'the story lost its closing correction');
  assert.ok(lines.indexOf(SUPERSEDED_LINE) < lines.indexOf(CORRECTED_LINE), 'the correction no longer follows what it corrects');

  // Three verse blocks: the rules note, the eight-line verse, and the corrected
  // line. The author's emphasis is carried as data, not as markup in the text.
  const verses = story.body.filter((b) => b.type === 'verse');
  assert.equal(verses.length, 3);
  assert.deepEqual(verses.map((v) => v.stanzas.map((s) => s.length)), [[3], [4, 4], [1]]);
  for (const block of story.body) {
    const haystack = block.type === 'verse' ? block.stanzas.flat().join('\n') : block.text;
    assert.doesNotMatch(haystack, /[<>*_`]/, 'the body carries markup instead of plain text');
    for (const phrase of block.emphasis ?? []) {
      assert.ok(haystack.includes(phrase), `emphasis "${phrase}" does not occur in its block`);
    }
  }
  assert.equal(story.body.filter((b) => b.emphasis?.length).length, 2, 'the author\'s two emphases are no longer both present');
});

/** The reading column of a generated page, as plain lines. */
function renderedBody(html) {
  const section = /<section class="story__body"[^>]*>([\s\S]*?)<\/section>/.exec(html);
  assert.ok(section, 'the page has no story body');
  return section[1]
    .replace(/<\/?strong>/g, '')       // inline emphasis does not break a line
    .replace(/<br>/g, '\n')
    .replace(/<[^>]*>/g, '\n')
    .replace(/&lt;/g, '<').replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"').replace(/&#39;/g, "'")
    .replace(/&amp;/g, '&')
    .split('\n').map((line) => line.trim()).filter(Boolean);
}

test('the reading page renders the canonical body exactly, in both locales and at either base path', () => {
  const story = onlyStory();
  const expected = bodyLines(story);

  for (const [label, r] of DEPLOYMENTS().map(([l, b]) => [l, b])) {
    for (const loc of LOCALES) {
      const html = read(r, pageAt(loc, `stories/${story.story_id}/index.html`));
      assert.deepEqual(renderedBody(html), expected,
        `${label}/${loc.code}: the rendered body is not the canonical text, line for line`);
      // The body is the author's language in every locale, and says so.
      assert.match(html, new RegExp(`<section class="story__body"[^>]*lang="${story.body_language}"`),
        `${label}/${loc.code}: the body does not declare the language it is written in`);
      assert.equal([...html.matchAll(/<strong>/g)].length, 2,
        `${label}/${loc.code}: the author's emphasis did not survive rendering`);
    }
  }
});

test('the English view publishes the Chinese original rather than a translation of it', () => {
  const story = onlyStory();
  const r = rootBuild();
  const en = read(r, `stories/${story.story_id}/index.html`);
  const zh = read(r, `zh/stories/${story.story_id}/index.html`);

  // The strongest available statement of "not machine-translated": the two page
  // sets carry the same bytes of literary text.
  const enBody = /<section class="story__body"[\s\S]*?<\/section>/.exec(en)[0];
  const zhBody = /<section class="story__body"[\s\S]*?<\/section>/.exec(zh)[0];
  assert.equal(enBody, zhBody, 'the English page shows a different body from the Chinese one');

  // And the English page says what the reader is looking at, before they reach it.
  assert.ok(en.includes(esc(story.locales.en.abstract)), 'the English page does not show its English abstract');
  assert.ok(en.includes(esc(story.locales.en.body_language_note)), 'the English page does not label the text as the Chinese original');
  assert.match(en, /Chinese original/, 'the English page never uses the words "Chinese original"');
  assert.ok(en.includes(esc(story.title.canonical)), 'the English page hides the work\'s own title');
  assert.ok(en.includes(`${esc('Original title')}: ${esc(story.title.canonical)}`), 'the canonical title is shown unlabelled');
  assert.ok(en.includes(esc(story.locales.en.title)), 'the English page does not show its English title');
  // The Chinese page shows the work under its own title and nothing borrowed.
  assert.ok(zh.includes(esc(story.locales.zh.title)));
  assert.ok(!zh.includes(esc(story.locales.en.abstract)), 'the English abstract leaked into the Chinese page');
});

// ================================================ navigation, in both locales

test('both locales navigate to the shelf, and the switch keeps the route', () => {
  const story = onlyStory();
  const { shelf } = loaded();

  for (const [label, r, base] of DEPLOYMENTS()) {
    for (const loc of LOCALES) {
      const shelfTitle = shelf.locales[loc.code].title;
      for (const rel of ['index.html', 'recipes/index.html', 'stories/index.html', 'about/index.html', `stories/${story.story_id}/index.html`]) {
        const html = read(r, pageAt(loc, rel));
        // The masthead offers the shelf, in this locale's words, at this base.
        assert.ok(html.includes(`<a href="${base}${loc.prefix}stories/">`) || html.includes(`<a href="${base}${loc.prefix}stories/" aria-current="page">`),
          `${label}/${loc.code}/${rel}: no link to the story shelf in the masthead`);
        assert.ok(html.includes(`>${esc(shelfTitle)}</a>`), `${label}/${loc.code}/${rel}: the shelf is not labelled in this locale`);
      }
      // The shelf and the reading page mark themselves as the current section.
      for (const rel of ['stories/index.html', `stories/${story.story_id}/index.html`]) {
        assert.ok(read(r, pageAt(loc, rel)).includes(`href="${base}${loc.prefix}stories/" aria-current="page"`),
          `${label}/${loc.code}/${rel}: the story shelf is not the current nav item`);
      }
    }

    // Switching language keeps the route, both ways, on both story routes.
    for (const route of ['stories/', `stories/${story.story_id}/`]) {
      const hrefOf = (html, code) => new RegExp(`<a href="([^"]+)"[^>]*data-locale-code="${code}"`).exec(html)?.[1];
      const en = read(r, `${route}index.html`);
      const zh = read(r, `zh/${route}index.html`);
      assert.equal(hrefOf(en, 'zh'), `${base}zh/${route}`, `${label}: en ${route} does not switch to the same zh route`);
      assert.equal(hrefOf(en, 'en'), `${base}${route}`, `${label}: en ${route} self link is not self`);
      assert.equal(hrefOf(zh, 'en'), `${base}${route}`, `${label}: zh ${route} does not switch back to the same en route`);
      assert.equal(hrefOf(zh, 'zh'), `${base}zh/${route}`, `${label}: zh ${route} self link is not self`);
    }

    // The hall opens the shelf in each locale, beside the recipe collection.
    for (const loc of LOCALES) {
      const hall = read(r, pageAt(loc, 'index.html'));
      assert.ok(hall.includes(`class="shelf__link" href="${base}${loc.prefix}stories/"`), `${label}/${loc.code}: the hall does not open the story shelf`);
      assert.ok(hall.includes(`class="shelf__link" href="${base}${loc.prefix}recipes/"`), `${label}/${loc.code}: the hall stopped opening the recipe collection`);
    }
  }
});

test('the reading page ends with a way back to the shelf, and no other navigation', () => {
  const story = onlyStory();
  const { shelf } = loaded();
  for (const [label, r, base] of DEPLOYMENTS()) {
    for (const loc of LOCALES) {
      const html = read(r, pageAt(loc, `stories/${story.story_id}/index.html`));
      assert.match(html, /<nav class="story-nav"/, `${label}/${loc.code}: no return navigation`);
      assert.ok(html.includes(`<a class="story-nav__index" href="${base}${loc.prefix}stories/">`),
        `${label}/${loc.code}: the return link does not point at the shelf`);
      // The crumb also goes back, through the shelf's own name.
      assert.ok(html.includes(`<a href="${base}${loc.prefix}stories/">${esc(shelf.locales[loc.code].title)}</a>`),
        `${label}/${loc.code}: the breadcrumb does not name the shelf`);
      // Nothing a reading page has no business carrying.
      for (const unwanted of ['data-grid', 'data-filters', 'record-nav__prev', 'record-nav__next', 'autoplay', '<iframe', '<video', '<audio']) {
        assert.ok(!html.includes(unwanted), `${label}/${loc.code}: the reading page carries "${unwanted}"`);
      }
    }
  }
});

test('the required footer credit is on the story pages too, with both holders linked', () => {
  const cfg = loadConfig({});
  const story = onlyStory();
  const REQUIRED = '© 2026 JJYDXFS & Atom (原子). All rights reserved.';
  for (const [label, r] of DEPLOYMENTS().map(([l, b]) => [l, b])) {
    for (const loc of LOCALES) {
      for (const rel of ['stories/index.html', `stories/${story.story_id}/index.html`]) {
        const html = read(r, pageAt(loc, rel));
        const line = /<p class="colophon__copyright">([\s\S]*?)<\/p>/.exec(html);
        assert.ok(line, `${label}/${loc.code}/${rel}: no copyright line`);
        assert.equal(line[1].replace(/<[^>]*>/g, '').replace(/&amp;/g, '&'), REQUIRED,
          `${label}/${loc.code}/${rel}: the visible credit is not the required line`);
        for (const [name, url] of Object.entries(cfg.copyright.links)) {
          assert.ok(line[1].includes(`<a href="${url}">${esc(name)}</a>`), `${label}/${loc.code}/${rel}: ${name} is not linked to ${url}`);
        }
      }
    }
  }
});

// ============================================================== the gates

const validStory = () => JSON.parse(JSON.stringify(onlyStory()));

test('the story rules reject a body that loses a block, or an emphasis that matches nothing', () => {
  const short = validStory();
  short.body = short.body.slice(0, -1);
  assert.ok(checkStory(short).some((e) => /body_block_count/.test(e)), 'a truncated body must fail the build');

  const stale = validStory();
  stale.body[0] = { ...stale.body[0], emphasis: ['这句话不在正文里'] };
  assert.ok(checkStory(stale).some((e) => /emphasis/.test(e)), 'an emphasis that matches nothing must fail the build');
});

test('the story rules reject a citation, a borrowed origin, or a missing locale', () => {
  const cited = validStory();
  cited.provenance.sources = ['https://example.org/somewhere'];
  assert.ok(checkStory(cited).some((e) => /no sources/.test(e)), 'an original work must not grow a citation');

  const bare = validStory();
  delete bare.locales.zh;
  assert.ok(checkStory(bare).some((e) => /no "zh" metadata/.test(e)), 'a story needs metadata for every interface locale');

  const undisclaimed = validStory();
  undisclaimed.locales.en.genre_note = 'A dialogue.';
  assert.ok(checkStory(undisclaimed).length > 0, 'a genre note that names neither fiction nor what the work is not must fail');

  const unauthored = validStory();
  unauthored.authorship.author.name = '   ';
  assert.ok(checkStory(unauthored).some((e) => /name its author/.test(e)));
});

test('the shelf rules refuse a work on disk the manifest does not list, and the reverse', () => {
  const { shelf, stories } = loaded();
  const ghost = { ...shelf, story_ids: [...shelf.story_ids, 'not-a-published-work'] };
  assert.ok(checkStoryShelf(ghost, stories).some((e) => /has no record/.test(e)),
    'a manifest entry with no record must fail the build');

  const unlisted = { ...shelf, story_ids: [] };
  assert.ok(checkStoryShelf(unlisted, stories).some((e) => /not listed/.test(e)),
    'a record the manifest does not list must fail the build rather than be published');
});

test('a locale view selects one locale\'s metadata and never touches the body', () => {
  const { shelf, stories } = loaded();
  for (const code of LOCALE_CODES) {
    const view = storyView(code, { shelf, stories });
    assert.equal(view.shelf.text, shelf.locales[code]);
    assert.deepEqual(view.stories.map((e) => e.record.story_id), shelf.story_ids);
    for (const entry of view.stories) {
      assert.equal(entry.text, entry.record.locales[code]);
      assert.deepEqual(entry.record.body, stories.find((s) => s.story_id === entry.record.story_id).body,
        `${code}: a locale view changed the body`);
    }
  }
  assert.equal(storyRoute(stories[0]), `${STORIES_ROUTE}${stories[0].story_id}/`);
  assert.equal(DEFAULT_LOCALE, 'en');
});

// ===================================================== nothing else leaks out

test('no story page, record, or export carries an operational path, receipt, or run detail', () => {
  // Patterns that would mean this shelf had been published straight out of a
  // working directory: a local absolute path, a run receipt, a harness name, a
  // transcript. None of them belongs in a public repository or its output.
  const FORBIDDEN = [
    /\.agent-office-runs/i, /\.agent-runs/i, /worker-report/i, /agent-harness/i,
    /\/Users\//, /\/home\/[a-z]/i, /[A-Z]:\\\\/, /OpenClawShare/i,
    /run[-_]receipt/i, /transcript/i, /\bLIBRARY_OUT_DIR=\//,
  ];
  const targets = [
    ...readdirSync(STORY_ITEM_DIR).map((f) => path.join(STORY_ITEM_DIR, f)),
    path.join(repoRoot, 'content', 'stories', 'shelf.json'),
    path.join(repoRoot, 'src', 'stories.mjs'),
    path.join(repoRoot, 'src', 'templates', 'stories.mjs'),
  ];
  for (const r of [rootBuild(), pagesBuild()]) {
    for (const rel of walk(r.outDir)) {
      if (rel.startsWith('stories') || rel.startsWith(path.join('zh', 'stories')) || rel === path.join('data', 'stories.json')) {
        targets.push(path.join(r.outDir, rel));
      }
    }
  }
  assert.ok(targets.length > 6, 'the leak scan found almost nothing to scan');

  for (const file of targets) {
    const body = readFileSync(file, 'utf8');
    for (const pattern of FORBIDDEN) {
      assert.doesNotMatch(body, pattern, `${path.relative(repoRoot, file)} matches ${pattern}`);
    }
  }
});

test('the shelf neither teases nor counts anything it has not published', () => {
  // A restrained shelf says what is on it. It does not promise more, hint at a
  // queue, or report a number larger than the works a reader can open.
  const TEASES = [
    /coming soon/i, /more to come/i, /stay tuned/i, /forthcoming/i, /\bdrafts?\b/i,
    /unpublished/i, /private shelf/i, /敬请期待/, /即将/, /未公开/, /草稿/, /更多故事/,
  ];
  for (const [label, r] of DEPLOYMENTS().map(([l, b]) => [l, b])) {
    for (const loc of LOCALES) {
      const pages = ['index.html', 'stories/index.html', 'about/index.html',
        ...PUBLISHED_IDS.map((id) => `stories/${id}/index.html`)];
      for (const rel of pages) {
        const html = read(r, pageAt(loc, rel));
        for (const pattern of TEASES) {
          assert.doesNotMatch(html, pattern, `${label}/${loc.code}/${rel} teases unpublished work: ${pattern}`);
        }
      }
      // Every number the shelf shows is the number of works a reader can open.
      const index = read(r, pageAt(loc, 'stories/index.html'));
      for (const match of index.matchAll(/class="story-shelf__count">([^<]*)</g)) {
        assert.match(match[1], new RegExp(`\\b${PUBLISHED.length}\\b`), `${label}/${loc.code}: the shelf reports a count it cannot show`);
      }
      assert.equal([...index.matchAll(/<li class="story-card">/g)].length, PUBLISHED.length,
        `${label}/${loc.code}: the shelf index shows a different number of works than it publishes`);
    }
  }
});

test('the story shelf changed nothing about the World Recipes collection', () => {
  // The two shelves share chrome and a footer and nothing else. If the recipe
  // routes, the record count, or the data export moved, that is a regression
  // regardless of how well the story shelf works.
  const r = rootBuild();
  assert.equal(r.itemCount, 16);
  const recipes = JSON.parse(read(r, 'data/world-recipes.json'));
  assert.equal(recipes.items.length, 16);
  assert.equal(recipes.collection.collection_id, 'world-recipes');
  for (const loc of LOCALES) {
    const gallery = read(r, pageAt(loc, 'recipes/index.html'));
    assert.equal([...gallery.matchAll(/<li class="card"/g)].length, 16, `${loc.code}: the recipe catalogue changed size`);
    assert.ok(!gallery.includes('story-card'), `${loc.code}: a story reached the recipe catalogue`);
  }
});
