// Agent Nursery: a third content type, beside the knowledge records and the
// story shelf.
//
// What makes it different from both is where its text lives. A recipe is a
// structured record and a story is a block list, but a handbook is a long
// authored manuscript, and the honest way to hold one is as the authors' own
// Markdown file, byte for byte, with the record wrapped around it rather than
// transcribed out of it. So content/agent-nursery/sources/ holds the
// manuscripts and nothing else does: this module reads them, checksums them
// against the record that claims them, parses them, and refuses to publish on
// any disagreement.
//
// Three gates follow from that arrangement, and they are the reason the module
// exists at all:
//
//   1. The manuscript cannot drift from the record. Every build recomputes
//      SHA-256 over the file and compares it with the declared digest, so an
//      edit to an author's text is a build failure until someone writes down
//      that it happened.
//   2. The reader cannot lose a passage. The parser fails on any line it cannot
//      account for, and the structure gate checks the headings the manuscript
//      actually has against the spine the record declares.
//   3. The collection cannot grow a product it has not published. Membership is
//      by handbook_id, and an id with no file — or a file no manifest lists —
//      fails the build rather than becoming an empty page.
//
// Like src/content.mjs and src/stories.mjs it never imports a template, so a
// manuscript stays readable with none of this project's presentation code.

import { readFileSync, readdirSync, existsSync } from 'node:fs';
import { createHash } from 'node:crypto';
import path from 'node:path';

import { repoRoot } from './config.mjs';
import { validate } from './schema-validate.mjs';
import { LOCALE_CODES } from './i18n.mjs';
import { parseMarkdown, headings, documentText } from './markdown.mjs';

const NURSERY_DIR = path.join(repoRoot, 'content', 'agent-nursery');
const HANDBOOK_DIR = path.join(NURSERY_DIR, 'handbooks');
const COLLECTION_FILE = path.join(NURSERY_DIR, 'collection.json');

/** Build-relative route the collection owns, inside whichever locale renders. */
export const NURSERY_ROUTE = 'collections/agent-nursery/';

/** Build-relative route of one handbook's reader. */
export const handbookRoute = (handbook) => (
  handbook.handbook_id === 'agent-nursery-handbook'
    // The collection's one handbook owns the short route; it is the artifact the
    // landing page is about, not an entry in a list of several.
    ? `${NURSERY_ROUTE}handbook/`
    : `${NURSERY_ROUTE}${handbook.handbook_id}/`
);

function readJson(file) {
  try {
    return JSON.parse(readFileSync(file, 'utf8'));
  } catch (err) {
    throw new Error(`${path.relative(repoRoot, file)}: ${err.message}`);
  }
}

const loadSchema = (name) => readJson(path.join(repoRoot, 'content', 'schema', `${name}.schema.json`));

const sha256 = (buffer) => createHash('sha256').update(buffer).digest('hex');

function pushIf(errors, condition, message) {
  if (condition) errors.push(message);
}

/** record_version must be the newest change_history entry, and history must chain. */
function checkVersionHistory(record, label) {
  const errors = [];
  const history = record.change_history;
  pushIf(errors, history[0].version !== record.record_version,
    `${label}: record_version "${record.record_version}" is not the first (newest) change_history entry "${history[0].version}"`);
  pushIf(errors, history[history.length - 1].supersedes !== null,
    `${label}: the oldest change_history entry must have supersedes: null`);
  for (let i = 0; i < history.length - 1; i += 1) {
    pushIf(errors, history[i].supersedes !== history[i + 1].version,
      `${label}: change_history entry "${history[i].version}" declares supersedes "${history[i].supersedes}" but follows "${history[i + 1].version}"`);
  }
  const versions = history.map((h) => h.version);
  pushIf(errors, new Set(versions).size !== versions.length, `${label}: duplicate version in change_history`);
  return errors;
}

/**
 * Every locale the site renders needs a complete metadata block. A handbook is
 * published in each language as its own edition rather than as a translation
 * overlay over an English original, so there is no original to fall back to.
 */
function checkLocaleParity(record, label, fields) {
  const errors = [];
  const present = Object.keys(record.locales);
  for (const code of LOCALE_CODES) {
    pushIf(errors, !present.includes(code), `${label}: no "${code}" metadata; every interface locale needs its own`);
  }
  for (const code of present) {
    pushIf(errors, !LOCALE_CODES.includes(code), `${label}: locales."${code}" is not an interface locale of this build`);
    for (const field of fields) {
      const value = record.locales[code]?.[field];
      pushIf(errors, typeof value !== 'string' || value.trim() === '',
        `${label}: locales.${code}.${field} must be a non-empty string`);
    }
  }
  return errors;
}

const COLLECTION_TEXT_FIELDS = [
  'title', 'description', 'aspiration_title', 'holdings_title', 'holdings_note',
  'scope_note', 'collection_notice',
];
const HANDBOOK_TEXT_FIELDS = [
  'title', 'abstract', 'nature_note', 'edition_note', 'language_note',
  'publication_note', 'rights_note',
];

// Agent Nursery is a real project, and its long-term goal is a real institution
// of the same name. Both of those the prose may say plainly. What the prose must
// also say, in every locale, is where that goal currently stands: the
// institution is not yet established and is not operating. The gate asks for
// that one statement of present status rather than banning the vocabulary — the
// page needs the noun "institution" in order to state the goal at all.
const INSTITUTION_DISCLAIMER = {
  en: /\binstitution\b[^.]*\b(has not been established|is not (yet )?established|does not (yet )?exist|is not operating|is not yet operating)\b/i,
  zh: /机构[^。；]*(尚未成立|尚未设立|尚未建立|尚未运营|未成立|没有成立|不在运营)/,
};

// ----------------------------------------------------------- manuscripts

/**
 * Read one manuscript, check it against the digest the record declares, parse
 * it, and hand back the blocks. The digest is recomputed from the bytes on
 * every build: that is the whole mechanism by which an author's text cannot be
 * edited without the record saying so.
 *
 * @returns {{blocks: object[], bytes: number, sha256: string, text: string, errors: string[]}}
 */
export function readManuscript(entry, label) {
  const errors = [];
  const file = path.join(NURSERY_DIR, entry.file);
  // The declared path is schema-constrained to sources/**.md, and is resolved
  // again here, so no record can reach outside the content tree.
  const resolved = path.resolve(file);
  if (!resolved.startsWith(path.join(NURSERY_DIR, 'sources') + path.sep)) {
    return { blocks: [], bytes: 0, sha256: '', text: '', errors: [`${label}: manuscript "${entry.file}" resolves outside content/agent-nursery/sources/`] };
  }
  if (!existsSync(resolved)) {
    return { blocks: [], bytes: 0, sha256: '', text: '', errors: [`${label}: manuscript "${entry.file}" is missing`] };
  }

  const buffer = readFileSync(resolved);
  const digest = sha256(buffer);
  pushIf(errors, digest !== entry.sha256,
    `${label}: manuscript "${entry.file}" hashes to ${digest} but the record declares ${entry.sha256}; the published text and the record that describes it have drifted apart`);
  pushIf(errors, buffer.length !== entry.bytes,
    `${label}: manuscript "${entry.file}" is ${buffer.length} bytes but the record declares ${entry.bytes}`);

  const text = buffer.toString('utf8');
  const parsed = parseMarkdown(text, path.posix.basename(entry.file));
  errors.push(...parsed.errors.map((e) => `${label}: ${e}`));

  return { blocks: parsed.blocks, bytes: buffer.length, sha256: digest, text, errors };
}

/**
 * The passage between a heading marker and the next `## ` heading, taken from
 * the raw manuscript rather than from the parse, so the digest is over exactly
 * the bytes the author wrote.
 *
 * @returns {string|null} null when the marker does not occur.
 */
export function prefacePassage(text, marker) {
  const start = text.indexOf(marker);
  if (start === -1) return null;
  const after = text.slice(start + marker.length);
  const end = after.indexOf('\n## ');
  return end === -1 ? after : after.slice(0, end);
}

/**
 * The structure gate. The record declares one language-independent spine; each
 * manuscript must have exactly those headings, in that order, at those levels.
 *
 * Getting this right is what makes a fragment survive the language switch: the
 * anchors are the declared section ids, so `#chapter-3` means the same place in
 * both page sets, and neither page set can quietly grow or drop a section.
 */
export function checkStructure(structure, manuscriptHeadings, label) {
  const errors = [];
  const expected = [];
  for (const section of structure.sections) {
    expected.push({ level: 2, id: section.section_id });
    for (const sub of section.subsections ?? []) expected.push({ level: 3, id: sub.section_id });
  }

  // The title is the one level-1 heading, and it is not part of the spine.
  const titles = manuscriptHeadings.filter((h) => h.level === 1);
  pushIf(errors, titles.length !== 1, `${label}: a manuscript needs exactly one level-1 title, found ${titles.length}`);
  pushIf(errors, manuscriptHeadings.length > 0 && manuscriptHeadings[0].level !== 1,
    `${label}: the manuscript does not open with its title`);

  const spine = manuscriptHeadings.filter((h) => h.level !== 1);
  if (spine.length !== expected.length) {
    errors.push(`${label}: the manuscript has ${spine.length} section headings but the record declares ${expected.length}`);
    return errors;
  }
  spine.forEach((heading, i) => {
    pushIf(errors, heading.level !== expected[i].level,
      `${label}: heading ${i + 1} ("${heading.text}") is level ${heading.level}, but section "${expected[i].id}" is declared at level ${expected[i].level}`);
    pushIf(errors, heading.text.trim() === '', `${label}: section "${expected[i].id}" has an empty heading`);
  });
  return errors;
}

/** The honesty gate for an authored handbook. */
export function checkHandbook(handbook, manuscripts) {
  const label = `handbook ${handbook.handbook_id}`;
  const errors = [];

  errors.push(...checkVersionHistory(handbook, label));
  errors.push(...checkLocaleParity(handbook, label, HANDBOOK_TEXT_FIELDS));

  // Written here, and nothing borrowed. An empty source list is the honest
  // state rather than a gap: the handbook summarizes no page, so it cites none.
  pushIf(errors, handbook.provenance.origin !== 'original-work',
    `${label}: provenance.origin must be "original-work"`);
  pushIf(errors, handbook.provenance.sources.length > 0,
    `${label}: an authored handbook carries no sources; it was written here, not retrieved`);
  pushIf(errors, handbook.rights.images.length > 0 && handbook.rights.image_rights_review_state !== 'cleared',
    `${label}: images are present but image_rights_review_state is "${handbook.rights.image_rights_review_state}"`);
  pushIf(errors, handbook.rights.images.length === 0 && handbook.rights.image_rights_review_state === 'cleared',
    `${label}: image_rights_review_state "cleared" but no images are recorded`);
  pushIf(errors, handbook.authorship.authors.length === 0,
    `${label}: a published handbook must name its authors`);

  // Exactly one manuscript is the source and the rest are translations of it.
  // A handbook with two sources would be making a claim about its own making
  // that this record cannot support.
  const roles = LOCALE_CODES.map((code) => handbook.manuscripts[code]?.manuscript_role);
  pushIf(errors, roles.filter((r) => r === 'source').length !== 1,
    `${label}: exactly one manuscript must be the source edition; the others are translations of it`);

  const declared = handbook.structure;
  const counted = {
    chapter: declared.sections.filter((s) => s.kind === 'chapter').length,
    appendix: declared.sections.filter((s) => s.kind === 'appendix').length,
    exercise: declared.sections.reduce((n, s) => n + (s.subsections ?? []).filter((x) => x.kind === 'exercise').length, 0),
  };
  pushIf(errors, counted.chapter !== declared.chapter_count,
    `${label}: structure declares ${declared.chapter_count} chapters but lists ${counted.chapter}`);
  pushIf(errors, counted.appendix !== declared.appendix_count,
    `${label}: structure declares ${declared.appendix_count} appendices but lists ${counted.appendix}`);
  pushIf(errors, counted.exercise !== declared.exercise_count,
    `${label}: structure declares ${declared.exercise_count} exercises but lists ${counted.exercise}`);
  pushIf(errors, declared.sections.filter((s) => s.kind === 'preface').length !== 1,
    `${label}: a handbook spine carries exactly one preface`);
  pushIf(errors, declared.sections.filter((s) => s.kind === 'revision-notes').length !== 1,
    `${label}: a living document carries exactly one revision-notes section, so a reader can see what changed`);

  const ids = [];
  for (const section of declared.sections) {
    ids.push(section.section_id);
    for (const sub of section.subsections ?? []) ids.push(sub.section_id);
  }
  pushIf(errors, new Set(ids).size !== ids.length, `${label}: duplicate section id in the declared spine`);

  const linkTargets = handbook.language_links.map((l) => l.target);
  pushIf(errors, new Set(linkTargets).size !== linkTargets.length,
    `${label}: duplicate language_links target`);

  for (const code of LOCALE_CODES) {
    const entry = handbook.manuscripts[code];
    const manuscript = manuscripts.get(code);
    if (!entry || !manuscript) {
      errors.push(`${label}: no manuscript for locale "${code}"`);
      continue;
    }
    const at = `${label} (${code})`;
    errors.push(...checkStructure(declared, headings(manuscript.blocks), at));

    // The preface is the passage the authors most care about keeping exactly as
    // written, so it carries its own digest beside the whole-file one.
    const passage = prefacePassage(manuscript.text, entry.preface_marker);
    if (passage === null) {
      errors.push(`${at}: the preface marker "${entry.preface_marker}" does not occur in the manuscript`);
    } else {
      const digest = sha256(Buffer.from(passage, 'utf8'));
      pushIf(errors, digest !== entry.preface_sha256,
        `${at}: the preface passage hashes to ${digest} but the record declares ${entry.preface_sha256}`);
    }

    // The manuscript ends on its own copyright line, and that line is the one
    // place the holders are linked. If the text no longer ends there, the
    // linking would silently attach to a different paragraph.
    const lines = documentText(manuscript.blocks);
    const last = lines[lines.length - 1] ?? '';
    pushIf(errors, last !== entry.copyright_line,
      `${at}: the manuscript ends on "${last}" but the record declares the closing line "${entry.copyright_line}"`);
    for (const holder of handbook.rights.holders) {
      const name = holder.replace(/\s*\(([^)]*)\)\s*$/, '').trim();
      pushIf(errors, !entry.copyright_line.includes(name),
        `${at}: the closing line does not name the rights holder "${name}"`);
    }
    // Every link in the manuscript must resolve to a locale this build renders.
    for (const block of manuscript.blocks) {
      const spanLists = block.type === 'heading' ? [block.spans] : block.lines.map((l) => l.spans);
      for (const spans of spanLists) {
        for (const span of spans) {
          if (span.type !== 'link') continue;
          pushIf(errors, !linkTargets.includes(span.target),
            `${at}: the manuscript links to "${span.target}", which language_links does not map to a locale`);
        }
      }
    }
  }

  return errors;
}

/** The honesty gate for the collection manifest. */
export function checkNurseryCollection(collection, handbooks) {
  const label = `collection ${collection.collection_id}`;
  const errors = [];
  const byId = new Map(handbooks.map((h) => [h.handbook_id, h]));

  errors.push(...checkVersionHistory(collection, label));
  errors.push(...checkLocaleParity(collection, label, COLLECTION_TEXT_FIELDS));

  const seen = new Set();
  for (const id of collection.handbook_ids) {
    pushIf(errors, !byId.has(id), `${label}: handbook_ids references "${id}", which has no record under content/agent-nursery/handbooks/`);
    pushIf(errors, seen.has(id), `${label}: duplicate handbook_id "${id}"`);
    seen.add(id);
  }
  // The manifest is the definition of what is published. A record on disk the
  // manifest does not list is not a draft the build may pick up, and a listed
  // id with no record is not a forthcoming product: both are errors.
  for (const handbook of handbooks) {
    pushIf(errors, handbook.collection_id !== collection.collection_id,
      `handbook ${handbook.handbook_id}: collection_id "${handbook.collection_id}" does not match the manifest "${collection.collection_id}"`);
    pushIf(errors, !collection.handbook_ids.includes(handbook.handbook_id),
      `handbook ${handbook.handbook_id}: exists on disk but is not listed in the "${collection.collection_id}" manifest`);
  }

  // A long-term goal states where it currently stands. Every locale of the
  // landing prose has to say that the institution the project is working toward
  // is not yet established and is not operating, so a reader cannot take the
  // goal for a going concern.
  for (const code of LOCALE_CODES) {
    const text = collection.locales[code];
    if (!text) continue;
    const prose = [...text.aspiration, text.collection_notice].join('\n');
    const disclaimer = INSTITUTION_DISCLAIMER[code];
    pushIf(errors, disclaimer !== undefined && !disclaimer.test(prose),
      `${label}: locales.${code} must state the present status of the institution the project is working toward — not yet established, not operating — alongside the goal itself`);
  }

  return errors;
}

/**
 * @returns {{collection: object|null, handbooks: object[], manuscripts: Map<string, Map<string, object>>, errors: string[]}}
 *   `manuscripts` is keyed by handbook_id, then by locale code. Errors are
 *   collected rather than thrown, so one run reports every problem.
 */
export function loadNursery() {
  const errors = [];
  if (!existsSync(COLLECTION_FILE)) {
    return {
      collection: null,
      handbooks: [],
      manuscripts: new Map(),
      errors: ['content/agent-nursery/collection.json is missing; the Agent Nursery collection has no manifest'],
    };
  }

  const collectionSchema = loadSchema('library-nursery-collection');
  const handbookSchema = loadSchema('library-handbook');

  const collection = readJson(COLLECTION_FILE);
  errors.push(...validate(collection, collectionSchema, 'agent-nursery/collection.json'));

  const files = existsSync(HANDBOOK_DIR)
    ? readdirSync(HANDBOOK_DIR).filter((f) => f.endsWith('.json')).sort()
    : [];
  const handbooks = files.map((f) => {
    const record = readJson(path.join(HANDBOOK_DIR, f));
    const schemaErrors = validate(record, handbookSchema, `agent-nursery/handbooks/${f}`);
    errors.push(...schemaErrors);
    if (schemaErrors.length === 0 && record.handbook_id !== path.basename(f, '.json')) {
      errors.push(`agent-nursery/handbooks/${f}: filename must match handbook_id "${record.handbook_id}"`);
    }
    return record;
  });

  const seen = new Set();
  for (const handbook of handbooks) {
    if (seen.has(handbook.handbook_id)) errors.push(`duplicate handbook_id "${handbook.handbook_id}" across content/agent-nursery/handbooks/`);
    seen.add(handbook.handbook_id);
  }

  const manuscripts = new Map();
  // Rules only run on records that already satisfy their schema; otherwise a
  // missing field surfaces as a TypeError instead of a readable report.
  if (errors.length === 0) {
    for (const handbook of handbooks) {
      const perLocale = new Map();
      for (const code of LOCALE_CODES) {
        const entry = handbook.manuscripts[code];
        if (!entry) continue;
        const read = readManuscript(entry, `handbook ${handbook.handbook_id} (${code})`);
        errors.push(...read.errors);
        perLocale.set(code, read);
      }
      manuscripts.set(handbook.handbook_id, perLocale);
    }
  }
  if (errors.length === 0) {
    for (const handbook of handbooks) errors.push(...checkHandbook(handbook, manuscripts.get(handbook.handbook_id)));
    errors.push(...checkNurseryCollection(collection, handbooks));
  }

  return { collection, handbooks, manuscripts, errors };
}

/** Load the collection and throw a single readable report if anything failed. */
export function loadNurseryOrThrow() {
  const loaded = loadNursery();
  if (loaded.errors.length > 0) {
    throw new Error(`Agent Nursery validation failed (${loaded.errors.length} problem(s)):\n  - ${loaded.errors.join('\n  - ')}`);
  }
  return loaded;
}

/**
 * One locale's view: the collection and its handbooks in manifest order, each
 * paired with the metadata block and the manuscript for this locale, and with
 * the manuscript's blocks already grouped under the declared section ids.
 */
export function nurseryView(code, { collection, handbooks, manuscripts }) {
  const textOf = (record, what) => {
    const text = record.locales[code];
    if (!text) throw new Error(`No "${code}" metadata on ${what}`);
    return text;
  };
  const byId = new Map(handbooks.map((h) => [h.handbook_id, h]));

  return {
    collection: { record: collection, text: textOf(collection, collection.collection_id) },
    handbooks: collection.handbook_ids.map((id) => {
      const record = byId.get(id);
      const manuscript = manuscripts.get(id)?.get(code);
      if (!manuscript) throw new Error(`No "${code}" manuscript for handbook "${id}"`);
      return {
        record,
        text: textOf(record, id),
        manuscript,
        document: sectionDocument(record.structure, manuscript.blocks),
      };
    }),
  };
}

/**
 * Group a parsed manuscript under the declared spine, so a template renders
 * sections rather than re-deriving them from heading levels.
 *
 * @returns {{title: object, front: object[], sections: object[]}}
 *   `front` is everything above the first `## ` heading — the edition line, the
 *   language line, and the authors' opening paragraphs. Each section is
 *   `{section_id, kind, heading, blocks, subsections}`.
 */
export function sectionDocument(structure, blocks) {
  const flat = [];
  for (const section of structure.sections) {
    flat.push({ ...section, level: 2 });
    for (const sub of section.subsections ?? []) flat.push({ ...sub, level: 3 });
  }

  const title = blocks.find((b) => b.type === 'heading' && b.level === 1) ?? null;
  const front = [];
  const built = [];
  let cursor = -1;

  for (const block of blocks) {
    if (block.type === 'heading' && block.level === 1) continue;
    if (block.type === 'heading' && (block.level === 2 || block.level === 3)) {
      cursor += 1;
      const declared = flat[cursor];
      built.push({
        section_id: declared.section_id,
        kind: declared.kind,
        level: block.level,
        heading: block.spans,
        blocks: [],
        subsections: [],
      });
      continue;
    }
    if (cursor === -1) front.push(block);
    else built[cursor].blocks.push(block);
  }

  // Nest the level-3 sections under the level-2 section that opened them, which
  // is how the reader renders them and how the contents list reads.
  const sections = [];
  for (const section of built) {
    if (section.level === 3 && sections.length > 0) sections[sections.length - 1].subsections.push(section);
    else sections.push(section);
  }

  return { title, front, sections };
}
