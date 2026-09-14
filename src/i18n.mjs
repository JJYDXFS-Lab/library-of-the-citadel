// Interface localization and record-translation overlays.
//
// One full page set is generated per locale: the default locale at the site
// root, every other locale under its own route prefix. Slugs and record IDs are
// identical in every locale, so switching language is a prefix swap that keeps
// the route, the record, the query string, and the fragment.
//
// Base records under content/items/ and content/collections/ stay canonical
// English and byte-identical. Translations are additive overlay files keyed by
// the records' own stable IDs (item_id, variant_id, method step, change-history
// version), so no ID and no part of the portable data contract moves.

import { readFileSync, existsSync } from 'node:fs';
import path from 'node:path';

import { repoRoot } from './config.mjs';

export const DEFAULT_LOCALE = 'en';

/** localStorage key for the persisted interface-language choice. */
export const LOCALE_STORAGE_KEY = 'library-of-the-citadel.locale';

/**
 * Supported locales in switch order. `prefix` is the build-relative route
 * prefix; the default locale owns the root and therefore has none.
 */
export const LOCALES = [
  { code: 'en', htmlLang: 'en', prefix: '', endonym: 'English', englishName: 'English' },
  { code: 'zh', htmlLang: 'zh-Hans', prefix: 'zh/', endonym: '中文', englishName: 'Chinese (Simplified)' },
];

export const LOCALE_CODES = LOCALES.map((l) => l.code);

export const localeByCode = (code) => LOCALES.find((l) => l.code === code);

const LOCALE_DIR = path.join(repoRoot, 'content', 'locales');

// Strings a non-default locale must translate because the default reads them
// from config/site.config.json, which holds one language only.
const SITE_KEYS = ['site.tagline', 'site.build_notice', 'site.footer_note', 'site.citadel_note'];

function readJson(file) {
  try {
    return JSON.parse(readFileSync(file, 'utf8'));
  } catch (err) {
    throw new Error(`${path.relative(repoRoot, file)}: ${err.message}`);
  }
}

/**
 * Load every interface dictionary and fail closed on any gap. Interface text is
 * not allowed to fall back: a missing or empty key is a build error, so a raw
 * dotted key can never reach a page.
 *
 * @returns {Map<string, Record<string, string>>}
 */
export function loadDictionaries() {
  const dicts = new Map();
  for (const loc of LOCALES) {
    const dict = readJson(path.join(LOCALE_DIR, 'ui', `${loc.code}.json`));
    delete dict.$comment;
    dicts.set(loc.code, dict);
  }

  const errors = [];
  const baseKeys = Object.keys(dicts.get(DEFAULT_LOCALE)).filter((k) => !k.startsWith('site.'));

  for (const [code, dict] of dicts) {
    const own = Object.keys(dict).filter((k) => !k.startsWith('site.'));
    for (const key of baseKeys) {
      if (!own.includes(key)) errors.push(`locales/ui/${code}.json: missing key "${key}"`);
    }
    for (const key of own) {
      if (!baseKeys.includes(key)) errors.push(`locales/ui/${code}.json: key "${key}" is not in the ${DEFAULT_LOCALE} dictionary`);
    }
    for (const [key, value] of Object.entries(dict)) {
      if (typeof value !== 'string' || value.trim() === '') {
        errors.push(`locales/ui/${code}.json: key "${key}" must be a non-empty string`);
      }
    }
    if (code !== DEFAULT_LOCALE) {
      for (const key of SITE_KEYS) {
        if (typeof dict[key] !== 'string') errors.push(`locales/ui/${code}.json: missing site string "${key}"`);
      }
    }
  }

  if (errors.length > 0) {
    throw new Error(`Interface dictionary check failed (${errors.length} problem(s)):\n  - ${errors.join('\n  - ')}`);
  }
  return dicts;
}

/** Substitute {braced} placeholders. An unknown placeholder is a build error. */
export function format(template, vars = {}) {
  return String(template).replace(/\{(\w+)\}/g, (match, name) => {
    if (!Object.prototype.hasOwnProperty.call(vars, name)) {
      throw new Error(`No value supplied for placeholder "${match}" in "${template}"`);
    }
    return String(vars[name]);
  });
}

/**
 * A locale context: the dictionary accessor, the four configured site strings in
 * this language, and the two path helpers every template links through.
 */
export function makeLocale(cfg, code, dicts = loadDictionaries()) {
  const meta = localeByCode(code);
  if (!meta) throw new Error(`Unknown locale "${code}"`);
  const dict = dicts.get(code);

  const raw = (key) => {
    const value = dict[key];
    if (value === undefined) throw new Error(`Missing interface string "${key}" for locale "${code}"`);
    return value;
  };
  const t = (key, vars) => format(raw(key), vars ?? {});
  t.raw = raw;

  const site = code === DEFAULT_LOCALE
    ? {
      tagline: cfg.tagline,
      buildNotice: cfg.buildNotice,
      footerNote: cfg.footerNote,
      citadelNote: cfg.citadel.note,
    }
    : {
      tagline: raw('site.tagline'),
      buildNotice: raw('site.build_notice'),
      footerNote: raw('site.footer_note'),
      citadelNote: raw('site.citadel_note'),
    };

  return {
    code,
    htmlLang: meta.htmlLang,
    prefix: meta.prefix,
    endonym: meta.endonym,
    englishName: meta.englishName,
    isDefault: code === DEFAULT_LOCALE,
    t,
    site,
    /** Link to a build-relative route inside this locale. */
    path: (relative = '') => cfg.withBase(`${meta.prefix}${relative}`),
    /** The same build-relative route in another locale — the switch target. */
    pathIn: (otherCode, relative = '') => {
      const other = localeByCode(otherCode);
      if (!other) throw new Error(`Unknown locale "${otherCode}"`);
      return cfg.withBase(`${other.prefix}${relative}`);
    },
  };
}

// ------------------------------------------------------- record overlays

/**
 * @returns {object|null} The overlay for one record, or null when the locale is
 *   the source language or no translation has been written yet. A missing file
 *   is the normal untranslated state, not an error.
 */
export function loadOverlay(kind, code, id) {
  if (code === DEFAULT_LOCALE) return null;
  const file = path.join(LOCALE_DIR, kind, code, `${id}.json`);
  if (!existsSync(file)) return null;
  const overlay = readJson(file);
  delete overlay.$comment;
  return overlay;
}

/**
 * Counts how many translatable slots a record has and how many the overlay
 * actually filled, so the page can state the translation state honestly instead
 * of implying a complete translation.
 */
function tracker() {
  const count = { total: 0, filled: 0 };
  const pick = (original, translated) => {
    count.total += 1;
    if (typeof translated === 'string' && translated.trim() !== '') {
      count.filled += 1;
      return translated;
    }
    return original;
  };
  const pickList = (original, translated) => {
    count.total += 1;
    const usable = Array.isArray(translated)
      && translated.length === original.length
      && translated.every((s) => typeof s === 'string' && s.trim() !== '');
    if (usable) {
      count.filled += 1;
      return translated;
    }
    return original;
  };
  return { count, pick, pickList };
}

function stateOf(count, code, overlay) {
  if (code === DEFAULT_LOCALE) return 'source';
  if (!overlay || count.filled === 0) return 'none';
  return count.filled === count.total ? 'complete' : 'partial';
}

/**
 * @returns {{record: object, state: string, english: object, canonicalRegion: string}}
 *   `record` keeps the item schema shape, so a localized data export stays a
 *   drop-in view of the canonical one. `canonicalRegion` is the English region
 *   label, which is what the gallery filter and the ?region= query use.
 */
export function localizeItem(item, overlay, code) {
  const o = overlay ?? {};
  const { count, pick, pickList } = tracker();
  const variants = o.variants ?? {};
  const ingredients = o.ingredients ?? {};
  const method = o.method ?? {};
  const history = o.change_history ?? {};

  const record = {
    ...item,
    record_notice: pick(item.record_notice, o.record_notice),
    name: {
      ...item.name,
      primary: pick(item.name.primary, o.name?.primary),
      ...(item.name.alt ? { alt: pickList(item.name.alt, o.name?.alt) } : {}),
    },
    region: {
      ...item.region,
      label: pick(item.region.label, o.region?.label),
      cuisine_label: pick(item.region.cuisine_label, o.region?.cuisine_label),
    },
    summary: pick(item.summary, o.summary),
    variants: item.variants.map((v) => {
      const tv = variants[v.variant_id] ?? {};
      return {
        ...v,
        label: pick(v.label, tv.label),
        region_label: pick(v.region_label, tv.region_label),
        difference_note: pick(v.difference_note, tv.difference_note),
      };
    }),
    // Ingredient rows have no ID in the schema, so the overlay keys them by
    // their canonical English item text rather than by array position.
    ingredients: item.ingredients.map((g) => {
      const tg = ingredients[g.item] ?? {};
      const row = { ...g, item: pick(g.item, tg.item) };
      if (g.quantity !== undefined) row.quantity = pick(g.quantity, tg.quantity);
      if (g.note !== undefined) row.note = pick(g.note, tg.note);
      return row;
    }),
    method: item.method.map((m) => ({
      ...m,
      instruction: pick(m.instruction, method[String(m.step)]),
    })),
    ...(item.yield_note ? { yield_note: pick(item.yield_note, o.yield_note) } : {}),
    provenance_note: pick(item.provenance_note, o.provenance_note),
    change_history: item.change_history.map((h) => ({
      ...h,
      change: pick(h.change, history[h.version]),
    })),
    rights: { ...item.rights, content_license: pick(item.rights.content_license, o.rights?.content_license) },
    safety: { ...item.safety, caveats: pickList(item.safety.caveats, o.safety?.caveats) },
  };

  return { record, english: item, state: stateOf(count, code, overlay), canonicalRegion: item.region.label };
}

/** @returns {{record: object, state: string, english: object}} */
export function localizeCollection(collection, overlay, code) {
  const o = overlay ?? {};
  const { count, pick, pickList } = tracker();

  const record = {
    ...collection,
    record_notice: pick(collection.record_notice, o.record_notice),
    title: {
      ...collection.title,
      primary: pick(collection.title.primary, o.title?.primary),
      ...(collection.title.alt ? { alt: pickList(collection.title.alt, o.title?.alt) } : {}),
    },
    description: pick(collection.description, o.description),
    scope_note: pick(collection.scope_note, o.scope_note),
    rights: { ...collection.rights, content_license: pick(collection.rights.content_license, o.rights?.content_license) },
  };

  return { record, english: collection, state: stateOf(count, code, overlay) };
}

/**
 * Build one locale's view of the content: the localized collection and the
 * localized items in manifest order.
 */
export function localizeView(code, { collection, items }) {
  return {
    collection: localizeCollection(collection, loadOverlay('collections', code, collection.collection_id), code),
    entries: items.map((item) => localizeItem(item, loadOverlay('items', code, item.item_id), code)),
  };
}

/**
 * Region filter options. The value stays the canonical English label so a
 * shared `?region=East+Asia` URL survives a language switch; only the visible
 * text is localized.
 *
 * @returns {{value: string, label: string}[]}
 */
export function localizedRegions(entries) {
  const seen = new Map();
  for (const entry of entries) {
    if (!seen.has(entry.canonicalRegion)) seen.set(entry.canonicalRegion, entry.record.region.label);
  }
  return [...seen.entries()]
    .map(([value, label]) => ({ value, label }))
    .sort((a, b) => a.label.localeCompare(b.label, 'en'));
}
