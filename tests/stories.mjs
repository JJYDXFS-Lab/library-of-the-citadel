// Checks for the story shelf. Node standard library only — node:test,
// node:assert, node:fs. There is nothing to install.
//
//   node --test tests/*.mjs
//
// Two things are being protected here, and they pull in opposite directions.
// One is completeness: a published literary text must reach the page whole, in
// order, in the language or languages its author wrote it in. The other is
// restraint: the shelf must publish exactly what was released and must say
// nothing — not a title, not a count, not a path — about anything that was not.
//
// So the census is an allowlist rather than a denylist. This file never names
// an unpublished work in order to check that it is absent; it asserts that the
// set of works the repository and the build know about is exactly the set that
// was released, which fails the same way without writing anything down.
//
// The shelf is heterogeneous: a Chinese-only dialogue by a single author with a
// verse at its close; a bilingual work written jointly, whose body is two
// aligned halves neither of which is a translation of the other; and a
// Chinese-only tale whose verse blocks are not verse at all but a written note,
// a three-line readout and a three-line class log. Nothing below may assume any
// one of those shapes. Every assertion is either a rule that holds for any
// literary work on this shelf, or an exact fingerprint declared per work in the
// allowlist — never a rule weakened until all of them happen to pass.

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
 *
 * Each entry also carries that work's own fingerprints — its opening and
 * closing lines, its verse structure, the number of places its author asked for
 * emphasis, and the phrases its notes must keep. If an edit ever reaches a
 * body or a disclaimer, one of them moves.
 */
const SHELF_ID = 'stories';

/** Named on both works and in the footer credit; the shelf shares one pair. */
const RIGHTS_HOLDERS = ['JJYDXFS', 'Atom (原子)'];

const PUBLISHED = [{
  story_id: 'citadel-night-dialogue-on-relation',
  canonical_title: '藏书城夜话：关系是何物',
  body_language: 'zh-Hans',
  blocks: 121,
  author: 'Atom (原子)',
  acknowledged: ['JJYDXFS (小Z)'],
  locale_titles: {
    en: 'Night Talk in the Citadel of Books: What Is a Relation?',
    // The Chinese view shows the work under the title its author gave it.
    zh: '藏书城夜话：关系是何物',
  },
  first_block: '夜半，藏书城闭馆。',
  last_block: '于是藏书城中，灯火大明。',
  // The turn at the end, where the author corrects one character of the verse.
  // The superseded line must stand in the verse and the correction after it;
  // losing either would flatten the point the story ends on.
  required_lines: ['一灯照见旧来人。', '一灯照见旧来身。'],
  ordered_lines: [['一灯照见旧来人。', '一灯照见旧来身。']],
  // Three verse blocks: the rules note, the eight-line verse, the corrected line.
  verse_shapes: [[3], [4, 4], [1]],
  emphasis_blocks: 2,
  strongs: 2,
  // Fiction, in the manner of a gong'an — and explicitly not scripture, not a
  // quotation, and carrying no Buddhist authority.
  genre_disclaimers: [/fiction|虚构/i, /gong'an|公案/i, /scripture|佛经/i, /quotation|引用/i, /authority|权威/i],
  credited: [/Atom/, /JJYDXFS/, /小Z/],
  en_abstract: [/Chinese original/i],
  en_language_note: [/Chinese original/i, /not translated|not machine-translated/i],
  en_page_phrase: /Chinese original/,
  bilingual: null,
}, {
  story_id: 'the-third-chair',
  canonical_title: '《第三把椅子》 / The Third Chair',
  // One work in two languages, so the body declares no single natural language.
  body_language: 'mul',
  blocks: 90,
  author: 'JJYDXFS & Atom (原子)',
  acknowledged: [],
  locale_titles: { en: 'The Third Chair', zh: '第三把椅子' },
  first_block: '中文',
  last_block: 'Good collaboration does not make three voices sound the same. It knows what each voice can prove—and what it cannot.',
  // The two section markers the reader navigates the bilingual body by.
  required_lines: ['中文', 'English'],
  ordered_lines: [['中文', 'English']],
  verse_shapes: [],
  emphasis_blocks: 10,
  strongs: 10,
  // Fiction in the form of a Socratic dialogue — and explicitly not a real
  // quotation, not research, not evidence, and not a claim of any kind.
  genre_disclaimers: [
    /fiction|虚构/i, /dialogue|对话/i, /quotation|原话|引用/i,
    /not research|不是研究/i, /not evidence|不是证据/i, /claim|主张/i,
  ],
  credited: [/Atom/, /JJYDXFS/],
  en_abstract: [/Bilingual original/i],
  en_language_note: [
    /bilingual original/i,
    /Neither version is a translation, a machine translation, or an abridgement of the other/,
  ],
  en_page_phrase: /bilingual original/i,
  // Two halves of equal length, each opened by its own section marker.
  bilingual: { markers: ['中文', 'English'], marker_at: [0, 45], half: 45 },
}, {
  story_id: 'agent-kindergarten',
  canonical_title: 'Agent 幼儿园：今天来了一个不会联网的小孩',
  body_language: 'zh-Hans',
  blocks: 179,
  author: 'Atom (原子)',
  acknowledged: ['JJYDXFS (小Z)'],
  locale_titles: {
    en: 'Agent Kindergarten: Today a Child Who Cannot Go Online Arrived',
    // The Chinese view shows the work under the title its author gave it.
    zh: 'Agent 幼儿园：今天来了一个不会联网的小孩',
  },
  first_block: 'Agent 幼儿园的招生条件很简单：',
  last_block: '“所以河先不要关。”',
  // The admission rule the story turns on, the scarf becoming a river, and the
  // two closing lines. Losing any of them would flatten what the tale is about.
  required_lines: ['三，别人只让你数到十的时候，不要证明。', '“现在有河了。”', '本园没有船。', '“所以河先不要关。”'],
  ordered_lines: [['“现在有河了。”', '本园没有船。'], ['本园没有船。', '“所以河先不要关。”']],
  // Three multi-line blocks, none of them a poem: the three admission
  // conditions, the three-line readout of the scarf, and the teacher's
  // three-paragraph class log.
  verse_shapes: [[3], [3], [1, 1, 1]],
  emphasis_blocks: 5,
  strongs: 5,
  // Fiction in the form of a fairy tale about agents — and explicitly not a
  // report, not a quotation, and not a claim about anyone real.
  genre_disclaimers: [
    /fiction|虚构/i, /fairy tale|童话/i, /not a report|不是报告/i,
    /fictional character|虚构角色/i, /quotation|引用/i, /claim|主张/i,
  ],
  credited: [/Atom/, /JJYDXFS/, /小Z/],
  en_abstract: [/Chinese original/i],
  en_language_note: [/Chinese original/i, /not translated|not machine-translated/i],
  en_page_phrase: /Chinese original/,
  bilingual: null,
}];
const PUBLISHED_IDS = PUBLISHED.map((s) => s.story_id);
const PUBLISHED_IDS_ON_DISK = [...PUBLISHED_IDS].sort();

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

/**
 * Each released work, paired with the allowlist entry that describes it. Every
 * per-record assertion below walks this rather than reaching for one story, so
 * a second work is checked as strictly as the first instead of being carried by
 * it.
 */
function published() {
  const byId = new Map(loaded().stories.map((s) => [s.story_id, s]));
  return PUBLISHED.map((entry) => {
    const story = byId.get(entry.story_id);
    assert.ok(story, `${entry.story_id}: released but has no record under content/stories/items/`);
    return { entry, story };
  });
}

// ==================================================== census: the three works

test('the shelf publishes exactly the released works — on disk, in the manifest, and nowhere else', () => {
  const { shelf, stories } = loaded();

  assert.deepEqual(readdirSync(STORY_ITEM_DIR).sort(), PUBLISHED_IDS.map((id) => `${id}.json`).sort(),
    'content/stories/items/ does not hold exactly the released works');
  assert.equal(shelf.shelf_id, SHELF_ID);
  assert.deepEqual(shelf.story_ids, PUBLISHED_IDS, 'the shelf manifest does not list exactly the released works');
  assert.deepEqual(stories.map((s) => s.story_id), PUBLISHED_IDS_ON_DISK);
  assert.equal(stories.length, PUBLISHED.length, 'exactly the released works are published');

  // Every title the repository knows about, in any language, is an allowlisted
  // one. This is what would fail if a further work were added to the tree, or
  // if a released work quietly grew a title nobody signed off on.
  const titles = new Set();
  for (const story of stories) {
    titles.add(story.title.canonical);
    for (const code of Object.keys(story.locales)) titles.add(story.locales[code].title);
  }
  const allowed = new Set(PUBLISHED.flatMap((e) => [e.canonical_title, ...Object.values(e.locale_titles)]));
  assert.deepEqual([...titles].sort(), [...allowed].sort(),
    'the tree carries a title that is not one of the released works');
});

test('the build emits the shelf and exactly the released reading pages, per locale, at either base path', () => {
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
      const linked = [...index.matchAll(/href="[^"]*stories\/([^"/]+)\//g)].map((m) => m[1]);
      assert.deepEqual([...new Set(linked)].sort(), [...PUBLISHED_IDS].sort(), `${label}/${loc.code}: the shelf index links something else`);
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
  assert.deepEqual([...data.stories].sort((a, b) => a.story_id.localeCompare(b.story_id)), loaded().stories, 'the export is not the canonical record set');
  for (const story of data.stories) {
    assert.deepEqual(story.provenance.sources, [], `${story.story_id}: an exported story grew a source`);
    assert.deepEqual(story.rights.images, []);
  }
});

// ====================================================== the records' contract

test('every story record carries its authorship, provenance, rights and publication note', () => {
  for (const { entry, story } of published()) {
    const where = entry.story_id;

    assert.equal(story.schema_version, 'library.story/1.0.0', where);
    assert.equal(story.shelf_id, SHELF_ID, where);
    assert.equal(story.record_class, 'original-fiction', where);
    assert.equal(story.title.canonical, entry.canonical_title, `${where}: the canonical title changed`);
    assert.equal(story.title.canonical_language, entry.body_language, where);
    assert.equal(story.body_language, entry.body_language, `${where}: the body no longer declares its released language`);

    // Authorship, and whoever is credited beside it. A single-author work names
    // its collaborator in the acknowledgements; a joint work names both people
    // in the author line and acknowledges nobody a second time.
    assert.equal(story.authorship.author.name, entry.author, `${where}: the author line changed`);
    assert.deepEqual(story.authorship.acknowledgements.map((a) => a.name), entry.acknowledged,
      `${where}: the acknowledgements are not the ones this work was released with`);

    // Original work: nothing cited, because nothing is summarized.
    assert.equal(story.provenance.origin, 'original-work', where);
    assert.deepEqual(story.provenance.sources, [], where);
    assert.ok(String(story.provenance.note).trim(), `${where}: no provenance note`);

    // Rights, named and reserved, matching the footer's holders.
    assert.deepEqual(story.rights.holders, RIGHTS_HOLDERS, `${where}: the rights holders moved`);
    assert.equal(story.rights.license_review_state, 'author-original-text', where);
    assert.match(story.rights.content_license, /All rights reserved/i, where);
    assert.deepEqual(story.rights.images, [], where);
    assert.equal(story.rights.image_rights_review_state, 'not-applicable', where);

    // Version and publication facts, and a history that begins at the beginning.
    assert.equal(story.record_version, story.change_history[0].version, where);
    assert.equal(story.change_history[story.change_history.length - 1].supersedes, null, where);
    assert.match(story.first_published, /^\d{4}-\d{2}-\d{2}$/, where);
    assert.equal(story.publication_ready, true, where);
  }
});

test('every locale of every work states what it is, what it is not, and who it is by', () => {
  for (const { entry, story } of published()) {
    const id = entry.story_id;
    assert.deepEqual(Object.keys(story.locales).sort(), [...LOCALE_CODES].sort(),
      `${id}: a story must carry complete metadata for every interface locale; it has no original to fall back to`);

    for (const code of LOCALE_CODES) {
      const text = story.locales[code];
      const where = `${id}/locales.${code}`;
      for (const field of ['title', 'abstract', 'genre_note', 'body_language_note', 'publication_note', 'acknowledgement', 'rights_note']) {
        assert.ok(String(text[field]).trim(), `${where}.${field} is empty`);
      }

      // The title this locale shows is the released one, and it is never the
      // canonical title borrowed silently: a view either renders the work's own
      // title because that is its language, or renders one for its readers and
      // shows the canonical title beside it.
      assert.equal(text.title, entry.locale_titles[code], `${where}.title is not the released title`);

      // What the work is, and — the whole reason a reader cannot mistake an
      // invented text for a quoted or researched one — what it is not.
      for (const pattern of entry.genre_disclaimers) {
        assert.match(text.genre_note, pattern, `${where}.genre_note no longer carries ${pattern}`);
      }

      // The publication note credits everyone the work is by and dates the release.
      for (const pattern of entry.credited) {
        assert.match(text.publication_note, pattern, `${where}.publication_note stopped crediting ${pattern}`);
      }
      assert.ok(text.publication_note.includes(story.first_published), `${where}.publication_note does not date the publication`);
      assert.ok(text.publication_note.includes(story.record_version), `${where}.publication_note does not state the record version`);
      assert.match(text.acknowledgement, /JJYDXFS/, `${where}.acknowledgement does not credit JJYDXFS`);
      assert.match(text.rights_note, /rights reserved|保留一切权利/i, `${where}.rights_note reserves nothing`);

      // Nothing on this shelf is machine-translated, and every locale has to say
      // so in its own words rather than leave the reader to assume it.
      assert.match(text.body_language_note, /machine[- ]translat|机器翻译/i,
        `${where}.body_language_note never mentions machine translation`);
      assert.match(text.body_language_note, /\bnot\b|neither|未经|不是|并非/i,
        `${where}.body_language_note mentions translation without denying it`);
    }

    // The English view labels the work for what it is — a Chinese original, or
    // an author-written bilingual original — instead of passing as a translation.
    for (const pattern of entry.en_abstract) {
      assert.match(story.locales.en.abstract, pattern, `${id}: locales.en.abstract no longer carries ${pattern}`);
    }
    for (const pattern of entry.en_language_note) {
      assert.match(story.locales.en.body_language_note, pattern, `${id}: locales.en.body_language_note no longer carries ${pattern}`);
    }
    assert.notEqual(story.locales.en.title, story.title.canonical,
      `${id}: the English view renders the title for its readers and says so; it does not silently reuse the canonical one`);
  }
});

// ======================================================= the bodies, exactly

/** Every line of the canonical body, flattened in reading order. */
const bodyLines = (story) => story.body.flatMap((b) => (b.type === 'verse' ? b.stanzas.flat() : [b.text]));

test('every canonical body is whole: every block, in order, nothing added or lost', () => {
  for (const { entry, story } of published()) {
    const where = entry.story_id;

    assert.equal(story.body.length, entry.blocks, `${where}: the body is not the released length`);
    assert.equal(story.body_block_count, story.body.length, `${where}: the declared block count no longer matches the body`);

    const lines = bodyLines(story);
    assert.equal(lines[0], entry.first_block, `${where}: the opening of the canonical text changed`);
    assert.equal(lines[lines.length - 1], entry.last_block, `${where}: the ending of the canonical text changed`);
    for (const line of lines) assert.ok(line.trim(), `${where}: the body carries an empty line`);

    // The lines this work is fingerprinted on, and the order they turn in.
    for (const line of entry.required_lines) {
      assert.ok(lines.includes(line), `${where}: the body lost the line "${line}"`);
    }
    for (const [before, after] of entry.ordered_lines) {
      assert.ok(lines.indexOf(before) < lines.indexOf(after),
        `${where}: "${after}" no longer follows "${before}"`);
    }

    // Verse where the work has verse, and none invented where it has none. The
    // author's emphasis is carried as data, not as markup in the text.
    const verses = story.body.filter((b) => b.type === 'verse');
    assert.deepEqual(verses.map((v) => v.stanzas.map((s) => s.length)), entry.verse_shapes,
      `${where}: the verse structure of the work changed`);
    for (const block of story.body) {
      const haystack = block.type === 'verse' ? block.stanzas.flat().join('\n') : block.text;
      assert.doesNotMatch(haystack, /[<>*_`]/, `${where}: the body carries markup instead of plain text`);
      for (const phrase of block.emphasis ?? []) {
        assert.ok(haystack.includes(phrase), `${where}: emphasis "${phrase}" does not occur in its block`);
      }
    }
    assert.equal(story.body.filter((b) => b.emphasis?.length).length, entry.emphasis_blocks,
      `${where}: the author's emphases are no longer exactly the released ones`);
  }
});

test('a bilingual body is two aligned halves, neither of them a translation of the other', () => {
  let checked = 0;
  for (const { entry, story } of published()) {
    if (!entry.bilingual) continue;
    checked += 1;
    const where = entry.story_id;
    const { markers, marker_at: at, half } = entry.bilingual;
    const texts = story.body.map((b) => b.text);

    // Each language opens under its own marker, once, at the released offset.
    for (const marker of markers) {
      assert.equal(texts.filter((t) => t === marker).length, 1,
        `${where}: the section marker "${marker}" is not carried exactly once`);
    }
    assert.deepEqual(markers.map((m) => texts.indexOf(m)), at, `${where}: the section markers moved`);
    assert.equal(story.body.length, markers.length * half,
      `${where}: the halves no longer account for the whole body`);
    at.forEach((start, i) => {
      assert.equal(start, i * half, `${where}: the "${markers[i]}" half does not begin where it should`);
    });

    // The two halves are the authors' own parallel writing, not one rendered
    // from the other — so the places they ask for emphasis line up block for
    // block. A half quietly regenerated from its sibling loses that alignment.
    const marksIn = (start) => story.body.slice(start, start + half)
      .map((b, i) => [i, (b.emphasis ?? []).length])
      .filter(([, n]) => n > 0);
    const first = marksIn(at[0]);
    assert.ok(first.length > 0, `${where}: the first half carries none of the authors' emphasis`);
    for (const start of at.slice(1)) {
      assert.deepEqual(marksIn(start), first,
        `${where}: the halves no longer carry the authors' emphasis at the same places`);
    }
  }
  assert.equal(checked, PUBLISHED.filter((e) => e.bilingual).length, 'a bilingual work went unchecked');
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

test('every reading page renders its canonical body exactly, in both locales and at either base path', () => {
  for (const { entry, story } of published()) {
    const expected = bodyLines(story);

    for (const [label, r] of DEPLOYMENTS().map(([l, b]) => [l, b])) {
      for (const loc of LOCALES) {
        const html = read(r, pageAt(loc, `stories/${story.story_id}/index.html`));
        assert.deepEqual(renderedBody(html), expected,
          `${label}/${loc.code}/${story.story_id}: the rendered body is not the canonical text, line for line`);
        // The body is the authors' own language in every locale, and says so.
        assert.match(html, new RegExp(`<section class="story__body"[^>]*lang="${story.body_language}"`),
          `${label}/${loc.code}/${story.story_id}: the body does not declare the language it is written in`);
        assert.equal([...html.matchAll(/<strong>/g)].length, entry.strongs,
          `${label}/${loc.code}/${story.story_id}: the authors' emphasis did not survive rendering`);
      }
    }
  }
});

test('both page sets publish the same body, and each says what the reader is looking at', () => {
  const r = rootBuild();
  const bodyOf = (html) => {
    const section = /<section class="story__body"[\s\S]*?<\/section>/.exec(html);
    assert.ok(section, 'the page has no story body');
    return section[0];
  };

  for (const { entry, story } of published()) {
    const id = story.story_id;
    const en = read(r, `stories/${id}/index.html`);
    const zh = read(r, `zh/stories/${id}/index.html`);

    // The strongest available statement of "not machine-translated": the two
    // page sets carry the same bytes of literary text.
    assert.equal(bodyOf(en), bodyOf(zh), `${id}: the English page shows a different body from the Chinese one`);

    // And the English page says what the reader is looking at, before they reach it.
    assert.ok(en.includes(esc(story.locales.en.abstract)), `${id}: the English page does not show its English abstract`);
    assert.ok(en.includes(esc(story.locales.en.body_language_note)), `${id}: the English page does not label the language of the text`);
    assert.match(en, entry.en_page_phrase, `${id}: the English page never says what kind of original it is showing`);
    assert.ok(en.includes(esc(story.title.canonical)), `${id}: the English page hides the work's own title`);
    assert.ok(en.includes(`${esc('Original title')}: ${esc(story.title.canonical)}`), `${id}: the canonical title is shown unlabelled`);
    assert.ok(en.includes(esc(story.locales.en.title)), `${id}: the English page does not show its English title`);
    // The Chinese page shows the work under its own title and nothing borrowed.
    assert.ok(zh.includes(esc(story.locales.zh.title)), `${id}: the Chinese page does not show its Chinese title`);
    assert.ok(!zh.includes(esc(story.locales.en.abstract)), `${id}: the English abstract leaked into the Chinese page`);
  }
});

// ================================================ navigation, in both locales

test('both locales navigate to the shelf, and the switch keeps the route', () => {
  const { shelf } = loaded();

  for (const [label, r, base] of DEPLOYMENTS()) {
    for (const loc of LOCALES) {
      const shelfTitle = shelf.locales[loc.code].title;
      const pages = ['index.html', 'recipes/index.html', 'stories/index.html', 'about/index.html',
        ...PUBLISHED_IDS.map((id) => `stories/${id}/index.html`)];
      for (const rel of pages) {
        const html = read(r, pageAt(loc, rel));
        // The masthead offers the shelf, in this locale's words, at this base.
        assert.ok(html.includes(`<a href="${base}${loc.prefix}stories/">`) || html.includes(`<a href="${base}${loc.prefix}stories/" aria-current="page">`),
          `${label}/${loc.code}/${rel}: no link to the story shelf in the masthead`);
        assert.ok(html.includes(`>${esc(shelfTitle)}</a>`), `${label}/${loc.code}/${rel}: the shelf is not labelled in this locale`);
      }
      // The shelf and every reading page mark themselves as the current section.
      for (const rel of ['stories/index.html', ...PUBLISHED_IDS.map((id) => `stories/${id}/index.html`)]) {
        assert.ok(read(r, pageAt(loc, rel)).includes(`href="${base}${loc.prefix}stories/" aria-current="page"`),
          `${label}/${loc.code}/${rel}: the story shelf is not the current nav item`);
      }
    }

    // Switching language keeps the route, both ways, on every story route.
    for (const route of ['stories/', ...PUBLISHED_IDS.map((id) => `stories/${id}/`)]) {
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

test('every reading page ends with a way back to the shelf, and no other navigation', () => {
  const { shelf } = loaded();
  for (const [label, r, base] of DEPLOYMENTS()) {
    for (const loc of LOCALES) {
      for (const id of PUBLISHED_IDS) {
        const html = read(r, pageAt(loc, `stories/${id}/index.html`));
        assert.match(html, /<nav class="story-nav"/, `${label}/${loc.code}/${id}: no return navigation`);
        assert.ok(html.includes(`<a class="story-nav__index" href="${base}${loc.prefix}stories/">`),
          `${label}/${loc.code}/${id}: the return link does not point at the shelf`);
        // The location trail also goes back, through the shelf's own name.
        assert.ok(html.includes(`<a href="${base}${loc.prefix}stories/">${esc(shelf.locales[loc.code].title)}</a>`),
          `${label}/${loc.code}/${id}: the trail does not name the shelf`);
        // Nothing a reading page has no business carrying.
        for (const unwanted of ['data-grid', 'data-filters', 'record-nav__prev', 'record-nav__next', 'autoplay', '<iframe', '<video', '<audio']) {
          assert.ok(!html.includes(unwanted), `${label}/${loc.code}/${id}: the reading page carries "${unwanted}"`);
        }
      }
    }
  }
});

test('every reading page keeps the shelf\'s identity and returns to it without inventing a next work', () => {
  const { shelf } = loaded();
  for (const { story } of published()) {
    const id = story.story_id;
    for (const [label, r, base] of DEPLOYMENTS()) {
      for (const loc of LOCALES) {
        const html = read(r, pageAt(loc, `stories/${id}/index.html`));
        const trail = /<nav class="trail"[\s\S]*?<\/nav>/.exec(html);
        assert.ok(trail, `${label}/${loc.code}/${id}: the reading page has no location trail`);
        // Hall, then the shelf wearing its room mark, then this work.
        assert.match(trail[0], new RegExp(`<a href="${base}${loc.prefix}">`),
          `${label}/${loc.code}/${id}: the trail does not start at the hall`);
        assert.match(trail[0], new RegExp(`<span class="room-mark">[^<]+</span> <a href="${base}${loc.prefix}stories/">`),
          `${label}/${loc.code}/${id}: the trail does not carry the shelf's room identity`);
        assert.ok(trail[0].includes(esc(shelf.locales[loc.code].title)), `${label}/${loc.code}/${id}: the room step is not in this locale`);
        assert.ok(trail[0].includes(esc(story.locales[loc.code].title)), `${label}/${loc.code}/${id}: the trail does not end at this work`);

        // The return rail states the shelf's own census — the number of works a
        // reader can actually open — and offers one way off the page. A shelf
        // holding more than one work still invents no "next": the way off is
        // back to the shelf, and there is exactly one of it.
        const context = /<p class="story-nav__context">([^<]*)<\/p>/.exec(html);
        assert.ok(context, `${label}/${loc.code}/${id}: the return rail gives no shelf context`);
        assert.match(context[1], new RegExp(`\\b${PUBLISHED.length}\\b`),
          `${label}/${loc.code}/${id}: the return context reports a count the shelf cannot show`);
        const navBlock = /<nav class="story-nav"[\s\S]*?<\/nav>/.exec(html)[0];
        assert.equal([...navBlock.matchAll(/<a /g)].length, 1,
          `${label}/${loc.code}/${id}: the return rail offers something other than the single way back`);
      }
    }
  }
});

test('the required footer credit is on every story page too, with both holders linked', () => {
  const cfg = loadConfig({});
  const REQUIRED = '© 2026 JJYDXFS & Atom (原子). All rights reserved.';
  assert.deepEqual(RIGHTS_HOLDERS, ['JJYDXFS', 'Atom (原子)'],
    'the footer credit and the records\' rights holders must name the same two people');
  for (const [label, r] of DEPLOYMENTS().map(([l, b]) => [l, b])) {
    for (const loc of LOCALES) {
      for (const rel of ['stories/index.html', ...PUBLISHED_IDS.map((id) => `stories/${id}/index.html`)]) {
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

/** Every released record, deep-copied, so a gate can be shown what it refuses. */
const validStories = () => loaded().stories.map((s) => [s.story_id, JSON.parse(JSON.stringify(s))]);

test('the story rules reject a body that loses a block, or an emphasis that matches nothing', () => {
  for (const [id, story] of validStories()) {
    const short = JSON.parse(JSON.stringify(story));
    short.body = short.body.slice(0, -1);
    assert.ok(checkStory(short).some((e) => /body_block_count/.test(e)), `${id}: a truncated body must fail the build`);

    const stale = JSON.parse(JSON.stringify(story));
    stale.body[0] = { ...stale.body[0], emphasis: ['这句话不在正文里'] };
    assert.ok(checkStory(stale).some((e) => /emphasis/.test(e)), `${id}: an emphasis that matches nothing must fail the build`);
  }
});

test('the story rules reject a citation, a borrowed origin, or a missing locale', () => {
  for (const [id, story] of validStories()) {
    const clone = () => JSON.parse(JSON.stringify(story));

    const cited = clone();
    cited.provenance.sources = ['https://example.org/somewhere'];
    assert.ok(checkStory(cited).some((e) => /no sources/.test(e)), `${id}: an original work must not grow a citation`);

    const bare = clone();
    delete bare.locales.zh;
    assert.ok(checkStory(bare).some((e) => /no "zh" metadata/.test(e)), `${id}: a story needs metadata for every interface locale`);

    const undisclaimed = clone();
    undisclaimed.locales.en.genre_note = 'A dialogue.';
    assert.ok(checkStory(undisclaimed).length > 0, `${id}: a genre note that names neither fiction nor what the work is not must fail`);

    const unauthored = clone();
    unauthored.authorship.author.name = '   ';
    assert.ok(checkStory(unauthored).some((e) => /name its author/.test(e)), `${id}: a published story must name its author`);
  }
});

test('the shelf rules refuse a work on disk the manifest does not list, and the reverse', () => {
  const { shelf, stories } = loaded();
  const ghost = { ...shelf, story_ids: [...shelf.story_ids, 'not-a-published-work'] };
  assert.ok(checkStoryShelf(ghost, stories).some((e) => /has no record/.test(e)),
    'a manifest entry with no record must fail the build');

  const unlisted = { ...shelf, story_ids: [] };
  const errors = checkStoryShelf(unlisted, stories).filter((e) => /not listed/.test(e));
  assert.equal(errors.length, stories.length,
    'every record the manifest does not list must fail the build rather than be published');

  // Dropping one work still fails, so a shelf of several cannot hide a record
  // behind the others' listings.
  for (const story of stories) {
    const partial = { ...shelf, story_ids: shelf.story_ids.filter((sid) => sid !== story.story_id) };
    assert.ok(checkStoryShelf(partial, stories).some((e) => new RegExp(`story ${story.story_id}: exists on disk`).test(e)),
      `${story.story_id}: an unlisted record must fail the build`);
  }
});

test('a locale view selects one locale\'s metadata and never touches the body', () => {
  const { shelf, stories } = loaded();
  for (const code of LOCALE_CODES) {
    const view = storyView(code, { shelf, stories });
    assert.equal(view.shelf.text, shelf.locales[code]);
    assert.deepEqual(view.stories.map((e) => e.record.story_id), shelf.story_ids);
    assert.equal(view.stories.length, PUBLISHED.length, `${code}: the view does not hold every released work`);
    for (const entry of view.stories) {
      assert.equal(entry.text, entry.record.locales[code]);
      assert.deepEqual(entry.record.body, stories.find((s) => s.story_id === entry.record.story_id).body,
        `${code}: a locale view changed the body`);
    }
  }
  for (const story of stories) {
    assert.equal(storyRoute(story), `${STORIES_ROUTE}${story.story_id}/`);
  }
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
