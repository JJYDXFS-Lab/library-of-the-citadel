// Deployment configuration resolution.
//
// Precedence: environment variable > config/site.config.json > built-in default.
// Nothing in this file (or anywhere in src/) knows a repository name, a remote
// URL, or a Pages host. The same build output shape works at "/" and at any
// subpath because every emitted link is composed through withBase().

import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

export const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

// The official project display name is exactly "Library of the Citadel". It is
// the built-in default as well as the configured value, so a build with no
// config file still carries the official name rather than a generic "Library"
// that reads like Atom-KB's separate Library.
const DEFAULTS = {
  siteName: 'Library of the Citadel',
  siteNameAlt: '',
  tagline: '',
  basePath: '/',
  citadel: { label: 'Citadel', url: '', note: '' },
  buildNotice: '',
  footerNote: '',
  // Attribution for this site's own presentation and editorial work. Empty by
  // default: the build states a holder only where one is configured, exactly as
  // it refuses to invent a Citadel destination.
  copyright: { year: '', holders: '' },
};

/**
 * A base path is stored in one canonical shape: "/" for root, or "/segment/"
 * (leading and trailing slash) for a subpath. Accepting the sloppy forms an
 * operator is likely to type — "library-preview", "/library-preview" — and
 * normalizing here is what keeps the rest of the build from branching on it.
 */
export function normalizeBasePath(raw) {
  let p = String(raw ?? '/').trim();
  if (p === '' || p === '/') return '/';
  if (!p.startsWith('/')) p = `/${p}`;
  if (!p.endsWith('/')) p = `${p}/`;
  return p.replace(/\/{2,}/g, '/');
}

/** Join a build-relative path (never leading-slash) onto the configured base. */
export function makeWithBase(basePath) {
  const base = normalizeBasePath(basePath);
  return function withBase(relative = '') {
    const rel = String(relative);
    if (rel.startsWith('/')) {
      throw new Error(`withBase() expects a build-relative path, got absolute "${rel}"`);
    }
    if (/^[a-z][a-z0-9+.-]*:/i.test(rel)) {
      throw new Error(`withBase() expects a build-relative path, got absolute URL "${rel}"`);
    }
    return `${base}${rel}`;
  };
}

/**
 * The build deletes the output directory before writing it. That makes an
 * unchecked LIBRARY_OUT_DIR a foot-gun: an empty value, ".", or "src" would
 * resolve onto the repository itself and take the sources with it. Refuse
 * anything that is not a fresh directory strictly inside the repository.
 */
export function resolveOutDir(raw) {
  if (raw !== undefined && String(raw).trim() === '') {
    throw new Error('LIBRARY_OUT_DIR must not be empty. Use a dedicated output directory such as "dist".');
  }
  const requested = String(raw ?? 'dist').trim();
  const resolved = path.resolve(repoRoot, requested);
  const relative = path.relative(repoRoot, resolved);

  if (relative === '' || relative.startsWith('..') || path.isAbsolute(relative)) {
    throw new Error(`LIBRARY_OUT_DIR "${requested}" resolves to "${resolved}", which is not inside the repository. The build deletes this directory before writing, so it must be a dedicated output directory.`);
  }
  const top = relative.split(path.sep)[0];
  const RESERVED = new Set(['src', 'content', 'config', 'docs', 'tests', '.git', '.agent-runs', '.agent-office-runs']);
  if (RESERVED.has(top)) {
    throw new Error(`LIBRARY_OUT_DIR "${requested}" points into the reserved directory "${top}". The build deletes its output directory before writing; choose a separate one such as "dist" or "dist-preview".`);
  }
  return resolved;
}

export function loadConfig(env = process.env) {
  let fileConfig = {};
  const configPath = path.join(repoRoot, 'config', 'site.config.json');
  try {
    fileConfig = JSON.parse(readFileSync(configPath, 'utf8'));
  } catch (err) {
    if (err.code !== 'ENOENT') throw new Error(`Could not read ${configPath}: ${err.message}`);
  }

  const citadel = { ...DEFAULTS.citadel, ...(fileConfig.citadel ?? {}) };
  if (env.LIBRARY_CITADEL_URL !== undefined) citadel.url = env.LIBRARY_CITADEL_URL;
  if (env.LIBRARY_CITADEL_LABEL !== undefined) citadel.label = env.LIBRARY_CITADEL_LABEL;
  citadel.url = String(citadel.url ?? '').trim();

  const copyright = { ...DEFAULTS.copyright, ...(fileConfig.copyright ?? {}) };

  const config = {
    ...DEFAULTS,
    ...fileConfig,
    citadel,
    copyright,
    siteName: env.LIBRARY_SITE_NAME ?? fileConfig.siteName ?? DEFAULTS.siteName,
    basePath: normalizeBasePath(env.LIBRARY_BASE_PATH ?? fileConfig.basePath ?? DEFAULTS.basePath),
    outDir: resolveOutDir(env.LIBRARY_OUT_DIR),
  };
  delete config.$comment;

  config.withBase = makeWithBase(config.basePath);
  return config;
}
