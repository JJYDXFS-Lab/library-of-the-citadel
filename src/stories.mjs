// Story shelves: a second content type beside the knowledge records.
//
// A story is a literary work, not a knowledge record. It claims nothing about
// the world, cites nothing because it summarizes nothing, and is published as
// its named author's own text. That makes its contract different in one way
// that matters: a knowledge record is canonically English with additive
// translation overlays, while a story has exactly one canonical language for
// its body and is never machine-translated. So a story carries its
// reader-facing metadata for every interface locale inside the record, under
// `locales`, and the body is single-sourced and shown unchanged in every view.
//
// This module mirrors src/content.mjs: read JSON, validate against the schema,
// apply the rules JSON Schema cannot express, hand back plain data. It never
// imports a template, so a story record stays readable with none of this
// project's presentation code. It does import the locale table, because "one
// complete metadata block per interface locale" is part of the contract this
// module enforces.

import { readFileSync, readdirSync, existsSync } from 'node:fs';
import path from 'node:path';

import { repoRoot } from './config.mjs';
import { validate } from './schema-validate.mjs';
import { LOCALE_CODES } from './i18n.mjs';

const STORIES_DIR = path.join(repoRoot, 'content', 'stories');
const STORY_ITEM_DIR = path.join(STORIES_DIR, 'items');
const SHELF_FILE = path.join(STORIES_DIR, 'shelf.json');

/** Build-relative route the shelf owns, inside whichever locale is rendering. */
export const STORIES_ROUTE = 'stories/';

/** Build-relative route of one story's reading page. */
export const storyRoute = (story) => `${STORIES_ROUTE}${story.story_id}/`;

function readJson(file) {
  try {
    return JSON.parse(readFileSync(file, 'utf8'));
  } catch (err) {
    throw new Error(`${path.relative(repoRoot, file)}: ${err.message}`);
  }
}

const loadSchema = (name) => readJson(path.join(repoRoot, 'content', 'schema', `${name}.schema.json`));

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
 * Every locale the site renders must have a complete metadata block, because a
 * story has no English original to fall back to. A missing block would either
 * blank a page or silently show a reader a language they did not choose.
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

const SHELF_TEXT_FIELDS = ['title', 'description', 'scope_note', 'shelf_notice'];
const STORY_TEXT_FIELDS = [
  'title', 'abstract', 'genre_note', 'body_language_note', 'publication_note',
  'acknowledgement', 'rights_note',
];

/**
 * The honesty gate for a literary work. It is the mirror image of the recipe
 * gates: where a knowledge record must not quietly acquire a claim it never
 * checked, a story must not quietly acquire a source, an authority, or a
 * provenance it does not have — and must not lose a paragraph of its body.
 */
export function checkStory(story) {
  const label = `story ${story.story_id}`;
  const errors = [];

  errors.push(...checkVersionHistory(story, label));
  errors.push(...checkLocaleParity(story, label, STORY_TEXT_FIELDS));

  pushIf(errors, story.body.length !== story.body_block_count,
    `${label}: body_block_count is ${story.body_block_count} but the body holds ${story.body.length} blocks; a published text must not lose or gain one silently`);

  story.body.forEach((block, i) => {
    const at = `${label}: body block ${i + 1}`;
    if (block.type === 'paragraph') {
      pushIf(errors, typeof block.text !== 'string' || block.text.trim() === '', `${at}: a paragraph needs "text"`);
      pushIf(errors, block.stanzas !== undefined, `${at}: a paragraph must not carry "stanzas"`);
    }
    if (block.type === 'verse') {
      pushIf(errors, !Array.isArray(block.stanzas) || block.stanzas.length === 0, `${at}: a verse needs "stanzas"`);
      pushIf(errors, block.text !== undefined, `${at}: a verse must not carry "text"`);
    }
    // A stale emphasis marker would render nothing and quietly lose the
    // author's emphasis, so it fails the build instead.
    const haystack = block.type === 'verse' ? (block.stanzas ?? []).flat().join('\n') : String(block.text ?? '');
    for (const phrase of block.emphasis ?? []) {
      pushIf(errors, !haystack.includes(phrase), `${at}: emphasis "${phrase}" does not occur in the block`);
    }
  });

  // Original work, and nothing borrowed. An empty source list is the honest
  // state here, not a gap: the story summarizes nobody, so there is nothing to
  // cite, and a work that ever needed a citation would not be this class.
  pushIf(errors, story.record_class !== 'original-fiction',
    `${label}: a story shelf holds original fiction only, got record_class "${story.record_class}"`);
  pushIf(errors, story.provenance.origin !== 'original-work',
    `${label}: provenance.origin must be "original-work"`);
  pushIf(errors, story.provenance.sources.length > 0,
    `${label}: an original work carries no sources; it was written here, not retrieved`);
  pushIf(errors, story.rights.images.length > 0 && story.rights.image_rights_review_state !== 'cleared',
    `${label}: images are present but image_rights_review_state is "${story.rights.image_rights_review_state}"`);
  pushIf(errors, story.rights.images.length === 0 && story.rights.image_rights_review_state === 'cleared',
    `${label}: image_rights_review_state "cleared" but no images are recorded`);
  pushIf(errors, !String(story.authorship.author.name).trim(),
    `${label}: a published story must name its author`);
  pushIf(errors, story.title.canonical_language !== story.body_language,
    `${label}: title.canonical_language "${story.title.canonical_language}" disagrees with body_language "${story.body_language}"`);

  // A released work has to say, in every language it is offered in, what kind
  // of text it is and what it is not. These two sentences are the whole reason
  // a reader cannot mistake an invented dialogue for a quoted tradition.
  if (story.publication_ready) {
    for (const code of LOCALE_CODES) {
      const text = story.locales[code];
      if (!text) continue;
      pushIf(errors, !/fiction|虚构/i.test(text.genre_note),
        `${label}: locales.${code}.genre_note must name the work as fiction, since it is the note every view renders`);
      pushIf(errors, !/\bnot\b|不是|并非/i.test(text.genre_note),
        `${label}: locales.${code}.genre_note must also state what the work is not, so an invented text is never read as a quoted one`);
    }
  }

  return errors;
}

export function checkStoryShelf(shelf, stories) {
  const label = `story shelf ${shelf.shelf_id}`;
  const errors = [];
  const byId = new Map(stories.map((s) => [s.story_id, s]));

  errors.push(...checkVersionHistory(shelf, label));
  errors.push(...checkLocaleParity(shelf, label, SHELF_TEXT_FIELDS));

  const seen = new Set();
  for (const id of shelf.story_ids) {
    pushIf(errors, !byId.has(id), `${label}: story_ids references "${id}", which has no record under content/stories/items/`);
    pushIf(errors, seen.has(id), `${label}: duplicate story_id "${id}"`);
    seen.add(id);
  }
  // The manifest is the definition of what is published. A record sitting on
  // disk that the manifest does not list is not a draft the build may pick up;
  // it is an error, and the build says so rather than publishing it.
  for (const story of stories) {
    pushIf(errors, story.shelf_id !== shelf.shelf_id,
      `story ${story.story_id}: shelf_id "${story.shelf_id}" does not match the manifest "${shelf.shelf_id}"`);
    pushIf(errors, !shelf.story_ids.includes(story.story_id),
      `story ${story.story_id}: exists on disk but is not listed in the "${shelf.shelf_id}" shelf manifest`);
  }

  return errors;
}

/**
 * @returns {{shelf: object|null, stories: object[], errors: string[]}}
 *   Errors are collected rather than thrown, so one run reports every problem.
 */
export function loadStories() {
  const errors = [];
  if (!existsSync(SHELF_FILE)) {
    return { shelf: null, stories: [], errors: ['content/stories/shelf.json is missing; the story shelf has no manifest'] };
  }

  const storySchema = loadSchema('library-story');
  const shelfSchema = loadSchema('library-story-shelf');

  const shelf = readJson(SHELF_FILE);
  errors.push(...validate(shelf, shelfSchema, 'stories/shelf.json'));

  const files = existsSync(STORY_ITEM_DIR)
    ? readdirSync(STORY_ITEM_DIR).filter((f) => f.endsWith('.json')).sort()
    : [];
  const stories = files.map((f) => {
    const record = readJson(path.join(STORY_ITEM_DIR, f));
    const schemaErrors = validate(record, storySchema, `stories/items/${f}`);
    errors.push(...schemaErrors);
    if (schemaErrors.length === 0 && record.story_id !== path.basename(f, '.json')) {
      errors.push(`stories/items/${f}: filename must match story_id "${record.story_id}"`);
    }
    return record;
  });

  const seen = new Set();
  for (const story of stories) {
    if (seen.has(story.story_id)) errors.push(`duplicate story_id "${story.story_id}" across content/stories/items/`);
    seen.add(story.story_id);
  }

  // Rules only run on records that already satisfy their schema; otherwise a
  // missing field surfaces as a TypeError instead of a readable report.
  if (errors.length === 0) {
    for (const story of stories) errors.push(...checkStory(story));
    errors.push(...checkStoryShelf(shelf, stories));
  }

  return { shelf, stories, errors };
}

/** Load the shelf and throw a single readable report if anything failed. */
export function loadStoriesOrThrow() {
  const loaded = loadStories();
  if (loaded.errors.length > 0) {
    throw new Error(`Story validation failed (${loaded.errors.length} problem(s)):\n  - ${loaded.errors.join('\n  - ')}`);
  }
  return loaded;
}

/**
 * One locale's view of the shelf: the shelf and its stories in manifest order,
 * each paired with the metadata block for this locale. The body is not part of
 * the pairing — it is the same canonical text in every locale, by design.
 *
 * @returns {{shelf: {record: object, text: object}, stories: {record: object, text: object}[]}}
 */
export function storyView(code, { shelf, stories }) {
  const textOf = (record) => {
    const text = record.locales[code];
    if (!text) throw new Error(`No "${code}" metadata on ${record.story_id ?? record.shelf_id}`);
    return text;
  };
  const byId = new Map(stories.map((s) => [s.story_id, s]));
  return {
    shelf: { record: shelf, text: textOf(shelf) },
    stories: shelf.story_ids.map((id) => {
      const record = byId.get(id);
      return { record, text: textOf(record) };
    }),
  };
}
