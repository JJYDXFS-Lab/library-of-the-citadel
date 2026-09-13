// Content loading: read JSON from disk, validate against the schemas, apply the
// cross-record rules, and hand back a plain data object. Presentation code never
// reads content/ directly, and this module never imports a template — the
// records stay usable with no Library presentation code at all.

import { readFileSync, readdirSync } from 'node:fs';
import path from 'node:path';

import { repoRoot } from './config.mjs';
import { validate } from './schema-validate.mjs';
import { checkCollection, checkItem } from './rules.mjs';

const CONTENT_DIR = path.join(repoRoot, 'content');

function readJson(file) {
  try {
    return JSON.parse(readFileSync(file, 'utf8'));
  } catch (err) {
    throw new Error(`${path.relative(repoRoot, file)}: ${err.message}`);
  }
}

function loadSchema(name) {
  return readJson(path.join(CONTENT_DIR, 'schema', `${name}.schema.json`));
}

/**
 * @returns {{collections: object[], items: object[], errors: string[]}}
 *   Errors are collected rather than thrown so a check run can report every
 *   problem at once instead of one per invocation.
 */
export function loadContent() {
  const itemSchema = loadSchema('library-item');
  const collectionSchema = loadSchema('library-collection');
  const errors = [];

  const itemDir = path.join(CONTENT_DIR, 'items');
  const items = readdirSync(itemDir)
    .filter((f) => f.endsWith('.json'))
    .sort()
    .map((f) => {
      const record = readJson(path.join(itemDir, f));
      const schemaErrors = validate(record, itemSchema, `items/${f}`);
      errors.push(...schemaErrors);
      if (schemaErrors.length === 0 && record.item_id !== path.basename(f, '.json')) {
        errors.push(`items/${f}: filename must match item_id "${record.item_id}"`);
      }
      return record;
    });

  const seenIds = new Set();
  for (const item of items) {
    if (seenIds.has(item.item_id)) errors.push(`duplicate item_id "${item.item_id}" across content/items/`);
    seenIds.add(item.item_id);
  }

  const collectionDir = path.join(CONTENT_DIR, 'collections');
  const collections = readdirSync(collectionDir)
    .filter((f) => f.endsWith('.json'))
    .sort()
    .map((f) => {
      const record = readJson(path.join(collectionDir, f));
      errors.push(...validate(record, collectionSchema, `collections/${f}`));
      return record;
    });

  // Rules only run on records that already satisfy their schema; otherwise a
  // missing field surfaces as a confusing TypeError instead of a clear report.
  if (errors.length === 0) {
    for (const item of items) errors.push(...checkItem(item));
    for (const collection of collections) {
      const owned = items.filter((i) => i.collection_id === collection.collection_id);
      errors.push(...checkCollection(collection, owned));
    }
  }

  return { collections, items, errors };
}

/** Load content and throw a single readable report if anything failed. */
export function loadContentOrThrow() {
  const content = loadContent();
  if (content.errors.length > 0) {
    throw new Error(`Content validation failed (${content.errors.length} problem(s)):\n  - ${content.errors.join('\n  - ')}`);
  }
  return content;
}

/** Distinct region labels across a set of items, for the gallery filter. */
export function regionsOf(items) {
  return [...new Set(items.map((i) => i.region.label))].sort();
}
