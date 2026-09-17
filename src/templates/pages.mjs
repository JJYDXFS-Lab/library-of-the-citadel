// HTML page templates. Plain template literals — no framework, no dependency.
//
// Every internal link goes through the locale's path helper, which composes
// cfg.withBase() with the locale's route prefix. The same templates therefore
// emit a correct site at "/", at "/any-subpath/", and in every locale. Detail
// pages are generated as real directories with index.html, which is what makes
// deep links and browser reload work on GitHub Pages without a server or a
// router.

import { LOCALES, LOCALE_STORAGE_KEY } from '../i18n.mjs';

const AMP = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };
export const esc = (value) => String(value ?? '').replace(/[&<>"']/g, (c) => AMP[c]);

/**
 * Localized string with HTML fragments substituted into its placeholders. The
 * translated text is escaped first and the fragments are inserted afterwards,
 * so a dictionary value can never inject markup.
 */
export const fill = (template, fragments) => esc(template).replace(/\{(\w+)\}/g, (match, name) => (
  Object.prototype.hasOwnProperty.call(fragments, name) ? fragments[name] : match
));

export const code = (value) => `<code>${esc(value)}</code>`;

const itemPath = (item) => `recipes/${item.item_id}/`;

/**
 * The gallery's one canonical catalogue: the filter controls and the grid of
 * record cards beneath them. A curated lens links here with its own section in
 * the query, so the affordance is a real link before any script runs.
 */
const CATALOGUE_ID = 'catalogue';
const SECTION_PARAM = 'section';

export const plural = (L, stem, count) => L.t(`${stem}.${count === 1 ? 'one' : 'other'}`, { count });

/**
 * The hall's public rooms, in hall order. A room mark is a presentation
 * coordinate — where a shelf stands in this hall — and nothing else: it makes
 * no claim about the records a room holds, the way `region.label_basis` makes
 * none about a dish. It exists so the identity a reader picks up in the hall is
 * the same one they still see on a single record three clicks later.
 */
export const ROOM = { collection: 1, stories: 2 };

export const roomMark = (L, index) => `<span class="room-mark">${esc(L.t('room.mark', { index }))}</span>`;

/**
 * The location trail: one ordered list from the hall down to the page the
 * reader is on, so "where am I" and "how do I get back" are the same control on
 * every page below the hall. A step is `[label, href|null, markHtml|null]`; the
 * last step is the current page and is never a link. The room's own index page
 * carries its mark in the heading instead, so the mark shows exactly once.
 *
 * The separator is drawn in CSS rather than emitted as text, so the trail reads
 * as a list of places rather than as a line of slashes.
 */
export function trail(L, steps) {
  const items = steps.map(([label, href, mark], i) => {
    const current = i === steps.length - 1;
    const body = href ? `<a href="${href}">${esc(label)}</a>` : `<span>${esc(label)}</span>`;
    return `    <li class="trail__step${current ? ' trail__step--current' : ''}"${current ? ' aria-current="page"' : ''}>${mark ? `${mark} ` : ''}${body}</li>`;
  }).join('\n');
  return `<nav class="trail" aria-label="${esc(L.t('trail.label'))}">
  <ol class="trail__path">
${items}
  </ol>
</nav>`;
}

export function head(cfg, L, { title, description }) {
  return `<!DOCTYPE html>
<html lang="${esc(L.htmlLang)}">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${esc(title)} · ${esc(cfg.siteName)}</title>
<meta name="description" content="${esc(description)}">
<meta name="robots" content="index, follow">
<link rel="stylesheet" href="${cfg.withBase('assets/site.css')}">
</head>`;
}

function citadelLink(cfg, L) {
  if (!cfg.citadel.url) {
    // No invented destination. The slot is visible but inert until configured.
    return `<span class="citadel-link citadel-link--unset" title="${esc(L.site.citadelNote)}">${esc(cfg.citadel.label)} ${esc(L.t('citadel.unset_suffix'))}</span>`;
  }
  return `<a class="citadel-link" href="${esc(cfg.citadel.url)}" rel="noopener">${esc(cfg.citadel.label)} →</a>`;
}

/**
 * The language switch. Real links to the counterpart page, both locales always
 * present, so it works with scripting disabled. Script only appends the current
 * query string and fragment, and records the choice.
 */
function localeSwitch(L, route) {
  const links = LOCALES.map((loc) => {
    const active = loc.code === L.code;
    return `    <a href="${L.pathIn(loc.code, route)}" lang="${esc(loc.htmlLang)}" hreflang="${esc(loc.htmlLang)}" data-locale-code="${esc(loc.code)}"${active ? ' aria-current="true"' : ''}>${esc(loc.endonym)}</a>`;
  }).join('\n');

  return `<nav class="locale-switch" aria-label="${esc(L.t('locale.group_label'))}" title="${esc(L.t('locale.switch_hint'))}" data-locale-switch data-locale-current="${esc(L.code)}" data-locale-key="${esc(LOCALE_STORAGE_KEY)}">
  <span class="locale-switch__label" aria-hidden="true">${esc(L.t('locale.group_label'))}</span>
${links}
</nav>`;
}

export function chrome(cfg, L, { nav: current, route }) {
  // One entry per shelf the hall holds, in hall order, then the build notes.
  // Both shelf labels come from their own manifests, so the navigation reads in
  // the reader's language without a second copy of either title in a
  // dictionary.
  const nav = [
    ['', L.t('nav.hall')],
    ['recipes/', L.collectionTitle],
    ['stories/', L.storiesTitle],
    ['about/', L.t('nav.about')],
  ];
  return `<a class="skip-link" href="#main">${esc(L.t('skip_link'))}</a>
<header class="masthead">
<a class="wordmark" href="${L.path('')}">
  <span class="wordmark__name">${esc(cfg.siteName)}</span>
  ${cfg.siteNameAlt ? `<span class="wordmark__alt">${esc(cfg.siteNameAlt)}</span>` : ''}
</a>
<nav class="masthead__nav">
${nav.map(([href, label]) => `  <a href="${L.path(href)}"${href === current ? ' aria-current="page"' : ''}>${esc(label)}</a>`).join('\n')}
</nav>
${localeSwitch(L, route)}
${citadelLink(cfg, L)}
</header>`;
}

/**
 * The holders line, with any holder that has a URL in `copyright.links`
 * rendered as a link to it. The string is escaped first and the anchor wrapped
 * around the already-escaped name, so the visible text is the same whether or
 * not a URL is configured and no configured value reaches the page unescaped.
 * Only http(s) URLs are linked; anything else stays plain text rather than
 * emitting a surprising scheme.
 */
function holdersHtml(cfg) {
  let html = esc(cfg.copyright.holders);
  for (const [name, url] of Object.entries(cfg.copyright.links ?? {})) {
    const safeName = esc(name);
    if (!safeName.trim() || !/^https?:\/\//i.test(String(url))) continue;
    html = html.split(safeName).join(`<a href="${esc(url)}">${safeName}</a>`);
  }
  return html;
}

export function foot(cfg, L) {
  // The copyright line covers this site's own presentation and editorial work
  // and is written the same way in every locale, the way a name is — including
  // the reservation of rights, which is a legal formula rather than prose. The
  // rights note beside it is prose and is therefore localized. Neither one
  // claims anything about third-party material beyond leaving its rights where
  // they are. An unconfigured holder renders no line rather than a guessed one.
  const reserved = String(cfg.copyright.reserved ?? '').trim();
  const copyright = String(cfg.copyright.holders).trim()
    ? `<p class="colophon__copyright">© ${esc(String(cfg.copyright.year))} ${holdersHtml(cfg)}.${reserved ? ` ${esc(reserved)}` : ''}</p>`
    : '';
  return `<footer class="colophon">
<p class="colophon__notice">${esc(L.site.buildNotice)}</p>
<p>${esc(L.site.footerNote)}</p>
<p class="colophon__rights">${esc(L.t('footer.rights_note'))}</p>
${copyright}
<p class="colophon__meta">${fill(L.t.raw('footer.base_path'), { basePath: code(cfg.basePath) })}</p>
</footer>
<script src="${cfg.withBase('assets/app.js')}" defer></script>
</body>
</html>`;
}

/**
 * The honesty banner. Its tag names what the reader is looking at: a record
 * banner takes the record's own class, while a collection or build notice —
 * which now covers records of both classes — takes the neutral tag.
 */
export const noticeBanner = (L, text, tagKey = 'notice.tag') => `<p class="fixture-banner" role="note"><span class="fixture-banner__tag">${esc(L.t(tagKey))}</span> ${esc(text)}</p>`;

const CLASS_TAG = { sourced: 'sourced.tag', 'practical-note': 'practical.tag', fixture: 'fixture.tag' };
const CLASS_MARK = { sourced: 'card.sourced', 'practical-note': 'card.practical', fixture: 'card.fixture' };

const classTag = (recordClass) => CLASS_TAG[recordClass] ?? 'fixture.tag';

const classMark = (recordClass) => CLASS_MARK[recordClass] ?? 'card.fixture';

/**
 * Record text that has no translation for this locale renders its English
 * original behind a visible notice rather than a blank or a raw key.
 */
function translationNotice(L, state) {
  if (state === 'source' || state === 'complete') return '';
  const key = state === 'none' ? 'translation.missing_notice' : 'translation.partial_notice';
  return `<p class="translation-notice" role="note" lang="${esc(L.htmlLang)}">${esc(L.t(key))}</p>`;
}

/**
 * A locale context carries the shelf titles it needs for the nav labels, so
 * chrome() does not have to be handed a manifest on every page. Each title
 * comes from the manifest that owns it, already in this locale.
 */
export function withShelfTitles(L, { collection, stories }) {
  return { ...L, collectionTitle: collection.title.primary, storiesTitle: stories.shelf.text.title };
}

// ---------------------------------------------------------------- hall

/**
 * One room on the hall's plan, drawn as the doorway into it: the arch head
 * carrying the room's number, the rhythm of what stands inside, then its own
 * title in the reader's language, what it holds, and how much of it. The whole
 * doorway is the link, so the room is one target rather than a card with a link
 * somewhere inside it.
 *
 * The numeral over the arch is the room mark's own index drawn at architectural
 * scale. It is decoration over a label that already says the same thing in
 * words, so it is hidden from assistive technology rather than read twice.
 */
function roomShelf(L, { index, href, title, alt, desc, count }) {
  return `      <li class="shelf shelf--room-${index}">
        <a class="shelf__link" href="${href}">
          <span class="shelf__head" aria-hidden="true"><span class="shelf__numeral">${esc(index)}</span></span>
          <span class="shelf__spine" aria-hidden="true"></span>
          <span class="shelf__body">
            ${roomMark(L, index)}
            <span class="shelf__title">${esc(title)}${alt ? `<span class="shelf__alt">${esc(alt)}</span>` : ''}</span>
            <span class="shelf__desc">${esc(desc)}</span>
            <span class="shelf__count">${esc(count)}</span>
          </span>
        </a>
      </li>`;
}

export function hallPage(cfg, L, view, { stories }) {
  const collection = view.collection.record;
  const items = view.entries.map((e) => e.record);
  return `${head(cfg, L, { title: L.t('page.title.hall'), description: L.t('meta.hall', { siteName: cfg.siteName, tagline: L.site.tagline }) })}
<body class="page page--hall">
${chrome(cfg, L, { nav: '', route: '' })}
<main id="main">
  <section class="hall" aria-labelledby="hall-title">
    <div class="hall__vault" aria-hidden="true">
      <span class="hall__arch hall__arch--outer"></span>
      <span class="hall__arch"></span>
      <span class="hall__arch hall__arch--crossing"></span>
      <span class="hall__arch"></span>
      <span class="hall__arch hall__arch--outer"></span>
    </div>
    <div class="hall__plaque">
      <h1 id="hall-title" class="hall__title">${esc(cfg.siteName)}${cfg.siteNameAlt ? `<span class="hall__title-alt">${esc(cfg.siteNameAlt)}</span>` : ''}</h1>
      <p class="hall__tagline">${esc(L.site.tagline)}</p>
    </div>

    <section class="rooms" aria-labelledby="rooms-title">
      <h2 id="rooms-title" class="section-title">${esc(L.t('hall.rooms_title'))}</h2>
      <ul class="shelf-list">
${roomShelf(L, {
    index: ROOM.collection,
    href: L.path('recipes/'),
    title: collection.title.primary,
    alt: (collection.title.alt ?? [])[0] ?? '',
    desc: collection.description,
    count: plural(L, 'hall.count', items.length),
  })}
${roomShelf(L, {
    index: ROOM.stories,
    href: L.path('stories/'),
    title: stories.shelf.text.title,
    alt: stories.shelf.text.title_alt ?? '',
    desc: stories.shelf.text.description,
    count: plural(L, 'hall.stories_count', stories.stories.length),
  })}
      </ul>
      <p class="rooms__further"><span class="rooms__further-title">${esc(L.t('hall.further_title'))}</span> ${esc(L.t('hall.further_desc'))}</p>
    </section>
  </section>

  ${noticeBanner(L, L.site.buildNotice)}

  <section class="reading-room" aria-labelledby="reading-room-title">
    <h2 id="reading-room-title" class="section-title">${esc(L.t('hall.what_title'))}</h2>
    <p>${esc(L.t('hall.what_body', { siteName: cfg.siteName }))}</p>
    <p class="reading-room__shared">${esc(L.t('hall.shared_note'))}</p>
    <p><a class="text-link" href="${L.path('about/')}">${esc(L.t('hall.what_link'))}</a></p>
  </section>
</main>
${foot(cfg, L)}`;
}

// ------------------------------------------------------------- gallery

function card(L, entry, sectionIds = []) {
  const item = entry.record;
  const en = entry.english;
  // The haystack carries the localized text and the English original, so a
  // search typed in either language finds the record.
  const terms = [
    item.name.primary, ...(item.name.alt ?? []), item.region.label, item.region.cuisine_label, item.summary,
    en.name.primary, ...(en.name.alt ?? []), en.region.label, en.region.cuisine_label, en.summary,
    ...(item.tags ?? []), ...item.variants.map((v) => v.label), ...en.variants.map((v) => v.label),
  ];
  // Section membership rides on the card as a machine facet, keyed by
  // section_id. That is what a lens filters on, so the lens mechanism is data
  // driven and works for any section the manifest declares.
  const sections = sectionIds.length ? ` data-sections="${esc(sectionIds.join(' '))}"` : '';
  return `<li class="card" data-item-id="${esc(item.item_id)}" data-region="${esc(entry.canonicalRegion)}"${sections} data-haystack="${esc([...new Set(terms)].join(' ').toLowerCase())}">
  <a class="card__link" href="${L.path(itemPath(item))}">
    <span class="card__marks">
      <span class="card__region">${esc(item.region.label)}</span>
      <span class="card__class">${esc(L.t(classMark(item.record_class)))}</span>
      ${entry.state === 'none' ? `<span class="card__untranslated">${esc(L.t('card.untranslated'))}</span>` : ''}
    </span>
    <h3 class="card__title">${esc(item.name.primary)}</h3>
    <p class="card__summary">${esc(item.summary)}</p>
    <span class="card__meta">
      <span>${esc(item.region.cuisine_label)}</span>
      <span>${esc(plural(L, 'card.variants', item.variants.length))}</span>
      <span>v${esc(item.record_version)}</span>
    </span>
  </a>
</li>`;
}

/**
 * Which sections of the collection each record belongs to, keyed by item_id.
 * The rules refuse a record claimed by two sections, but the facet is a list so
 * the presentation does not depend on that rule holding.
 */
function sectionsByItem(collection) {
  const map = new Map();
  for (const section of collection.sections ?? []) {
    for (const id of section.item_ids) {
      map.set(id, [...(map.get(id) ?? []), section.section_id]);
    }
  }
  return map;
}

/**
 * The collection's curated lenses: a compact heading, its count, the short
 * context the manifest gives it, and one affordance that narrows the catalogue
 * below to that section's records.
 *
 * A lens never renders its members a second time. Every record has exactly one
 * card, in the one canonical catalogue, so the search and the region filter
 * keep covering the whole collection and a reader with scripting disabled still
 * sees every record and every link. The affordance is a real link carrying
 * `?section=` and the catalogue's fragment, so it works from the keyboard and
 * can be shared; the script turns that link into an in-page filter.
 */
function collectionLenses(L, view) {
  const sections = view.collection.record.sections ?? [];
  if (sections.length === 0) return '';
  const held = new Set(view.entries.map((e) => e.record.item_id));

  return sections.map((section) => {
    const count = section.item_ids.filter((id) => held.has(id)).length;
    const headingId = `section-${section.section_id}`;
    const href = `${L.path('recipes/')}?${SECTION_PARAM}=${encodeURIComponent(section.section_id)}#${CATALOGUE_ID}`;
    return `  <section class="lens" aria-labelledby="${esc(headingId)}" data-lens="${esc(section.section_id)}">
    <h2 id="${esc(headingId)}" class="lens__title">${esc(section.title)} <span class="lens__count">${esc(plural(L, 'section.count', count))}</span></h2>
    <p class="lens__intro">${esc(section.intro)}</p>
    <p class="lens__actions"><a class="lens__action" href="${esc(href)}" data-lens-filter="${esc(section.section_id)}" aria-describedby="${esc(headingId)}">${esc(L.t('section.action', { count }))}</a></p>
  </section>`;
  }).join('\n');
}

export function galleryPage(cfg, L, view, { regions }) {
  const collection = view.collection.record;
  const total = view.entries.length;
  const sections = sectionsByItem(collection);
  return `${head(cfg, L, { title: collection.title.primary, description: collection.description })}
<body class="page page--gallery">
${chrome(cfg, L, { nav: 'recipes/', route: 'recipes/' })}
<main id="main">
  <header class="collection-head collection-head--room collection-head--room-${ROOM.collection}">
    ${trail(L, [[L.t('nav.hall'), L.path('')], [collection.title.primary, null]])}
    <p class="collection-head__room">${roomMark(L, ROOM.collection)}</p>
    <h1>${esc(collection.title.primary)}${(collection.title.alt ?? []).length ? `<span class="collection-head__alt">${esc(collection.title.alt[0])}</span>` : ''}</h1>
    <p class="collection-head__desc">${esc(collection.description)}</p>
  </header>

  ${noticeBanner(L, collection.record_notice)}
  ${translationNotice(L, view.collection.state)}

${collectionLenses(L, view)}

  <form class="filters" id="${CATALOGUE_ID}" role="search" aria-label="${esc(L.t('gallery.filters_label'))}" data-filters
    data-status-all="${esc(L.t.raw('gallery.status_all'))}"
    data-status-some="${esc(L.t.raw('gallery.status_some'))}"
    data-status-none="${esc(L.t.raw('gallery.status_none'))}">
    <div class="filters__field">
      <label for="q">${esc(L.t('gallery.search_label'))}</label>
      <input type="search" id="q" name="q" autocomplete="off" placeholder="${esc(L.t('gallery.search_placeholder'))}" data-search>
    </div>
    <div class="filters__field">
      <label for="region">${esc(L.t('gallery.region_label'))}</label>
      <select id="region" name="region" data-region>
        <option value="">${esc(L.t('gallery.region_all'))}</option>
${regions.map((r) => `        <option value="${esc(r.value)}">${esc(r.label)}</option>`).join('\n')}
      </select>
    </div>
    <button type="button" class="filters__reset" data-reset hidden>${esc(L.t('gallery.clear'))}</button>
    <p class="filters__status" aria-live="polite" data-status>${esc(L.t('gallery.status_all', { total }))}</p>
  </form>

  <ul class="card-grid" data-grid>
${view.entries.map((entry) => card(L, entry, sections.get(entry.record.item_id) ?? [])).join('\n')}
  </ul>

  <div class="empty-state" data-empty hidden>
    <p class="empty-state__title">${esc(L.t('gallery.empty_title'))}</p>
    <p>${esc(L.t('gallery.empty_body', { total }))}</p>
    <p class="empty-state__hint">${fill(L.t.raw('gallery.empty_hint'), {
      reset: `<button type="button" class="text-link" data-reset-inline>${esc(L.t('gallery.reset_both'))}</button>`,
    })}</p>
  </div>

  <noscript>
    <p class="noscript-note">${esc(L.t('gallery.noscript'))}</p>
  </noscript>
</main>
${foot(cfg, L)}`;
}

// -------------------------------------------------------------- detail

const defList = (rows) => `<dl class="facts">
${rows.map(([k, v]) => `  <div class="facts__row"><dt>${esc(k)}</dt><dd>${v}</dd></div>`).join('\n')}
</dl>`;

const TRANSLATION_FACT = {
  source: 'facts.translation_source',
  complete: 'facts.translation_complete',
  partial: 'facts.translation_partial',
  none: 'facts.translation_none',
};

export function detailPage(cfg, L, view, { entry, neighbours, position }) {
  const item = entry.record;
  const collection = view.collection.record;
  const sources = item.sources.length
    ? `<ul class="sources">${item.sources.map((s) => `<li><a href="${esc(s.url)}" rel="noopener">${esc(s.title)}</a> <span class="sources__date">${esc(L.t('sources.accessed', { date: s.accessed_at }))}</span>${s.note ? `<p class="sources__note">${esc(s.note)}</p>` : ''}</li>`).join('')}</ul>`
    : `<p class="sources sources--none">${esc(L.t('sources.none'))} <span class="muted">${esc(item.provenance_note)}</span></p>`;

  return `${head(cfg, L, { title: item.name.primary, description: item.summary })}
<body class="page page--detail">
${chrome(cfg, L, { nav: 'recipes/', route: itemPath(item) })}
<main id="main">
  <div class="threshold threshold--room-${ROOM.collection}">
    ${trail(L, [
    [L.t('nav.hall'), L.path('')],
    [collection.title.primary, L.path('recipes/'), roomMark(L, ROOM.collection)],
    [item.name.primary, null],
  ])}
  </div>

  ${noticeBanner(L, item.record_notice, classTag(item.record_class))}
  ${translationNotice(L, entry.state)}

  <article class="record">
    <header class="record__head">
      <p class="record__marks"><span class="card__region">${esc(item.region.label)}</span> <span class="card__class">${esc(L.t(classMark(item.record_class)))}</span></p>
      <h1>${esc(item.name.primary)}</h1>
      ${(item.name.alt ?? []).length ? `<p class="record__alt">${esc(item.name.alt.join(' · '))}</p>` : ''}
      <p class="record__summary">${esc(item.summary)}</p>
    </header>

    ${item.variants.length === 0 ? '' : `<section class="record__block" aria-labelledby="h-variants">
      <h2 id="h-variants">${esc(L.t('detail.variants_title'))}</h2>
      <p class="block-note">${esc(L.t('detail.variants_note'))}</p>
      <ul class="variants">
${item.variants.map((v) => `        <li class="variant"><p class="variant__label">${esc(v.label)}</p><p class="variant__region">${esc(v.region_label)}</p><p>${esc(v.difference_note)}</p></li>`).join('\n')}
      </ul>
    </section>`}

    <div class="record__columns">
      <section class="record__block" aria-labelledby="h-ingredients">
        <h2 id="h-ingredients">${esc(L.t('detail.ingredients_title'))}</h2>
        <ul class="ingredients">
${item.ingredients.map((g) => `          <li><span class="ingredients__qty">${esc(g.quantity ?? '')}</span> <span class="ingredients__item">${esc(g.item)}</span>${g.note ? `<span class="ingredients__note">${esc(g.note)}</span>` : ''}</li>`).join('\n')}
        </ul>
        ${item.yield_note ? `<p class="yield">${esc(L.t('detail.yield', { yield: item.yield_note }))}</p>` : ''}
      </section>

      <section class="record__block" aria-labelledby="h-method">
        <h2 id="h-method">${esc(L.t('detail.method_title'))}</h2>
        <ol class="method">
${item.method.map((m) => `          <li>${esc(m.instruction)}</li>`).join('\n')}
        </ol>
      </section>
    </div>

    <section class="record__block record__block--caution" aria-labelledby="h-safety">
      <h2 id="h-safety">${esc(L.t('detail.safety_title'))}</h2>
      <ul class="caveats">${item.safety.caveats.map((c) => `<li>${esc(c)}</li>`).join('')}</ul>
      <p class="block-note">${fill(L.t.raw('detail.safety_state'), { state: code(item.safety.review_state) })}</p>
    </section>

    <section class="record__block record__block--provenance" aria-labelledby="h-provenance">
      <h2 id="h-provenance">${esc(L.t('detail.provenance_title'))}</h2>
      ${defList([
        [L.t('facts.item_id'), code(item.item_id)],
        [L.t('facts.collection'), code(item.collection_id)],
        [L.t('facts.record_class'), `${code(item.record_class)} — ${esc(L.t(item.publication_ready ? 'facts.publication_ready' : 'facts.not_publication_ready'))}`],
        [L.t('facts.region_basis'), `${code(item.region.label_basis)} — ${esc(L.t('facts.region_basis_note'))}`],
        [L.t('facts.sources'), sources],
        [L.t('facts.source_state'), code(item.source_state)],
        [L.t('facts.reviewed'), esc(item.reviewed_at)],
        [L.t('facts.record_version'), code(item.record_version)],
        [L.t('facts.content_license'), `${esc(item.rights.content_license)} <span class="muted">${fill(L.t.raw('facts.license_review'), { state: code(item.rights.license_review_state) })}</span>`],
        [L.t('facts.image_rights'), `${code(item.rights.image_rights_review_state)} — ${esc(L.t('facts.images_count', { count: item.rights.images.length }))}`],
        [L.t('facts.translation'), `<span lang="${esc(L.htmlLang)}">${esc(L.t(TRANSLATION_FACT[entry.state]))}</span>`],
      ])}
      <h3 class="subhead">${esc(L.t('detail.history_title'))}</h3>
      <ol class="history">
${item.change_history.map((h) => `        <li><span class="history__version">v${esc(h.version)}</span> <span class="history__date">${esc(h.date)}</span><p>${esc(h.change)}</p><p class="muted">${esc(L.t('history.supersedes', { what: h.supersedes ? `v${h.supersedes}` : L.t('history.supersedes_none') }))}</p></li>`).join('\n')}
      </ol>
    </section>
  </article>

  <nav class="record-nav" aria-label="${esc(L.t('record_nav.label'))}">
    <p class="record-nav__position">${esc(L.t('record_nav.position', {
      index: position.index, total: position.total, collection: collection.title.primary,
    }))}</p>
    <div class="record-nav__rail">
      ${neighbours.prev ? `<a class="record-nav__prev" href="${L.path(itemPath(neighbours.prev))}"><span>${esc(L.t('record_nav.prev'))}</span>${esc(neighbours.prev.name.primary)}</a>` : '<span></span>'}
      <a class="record-nav__index" href="${L.path('recipes/')}">${esc(L.t('record_nav.index'))}</a>
      ${neighbours.next ? `<a class="record-nav__next" href="${L.path(itemPath(neighbours.next))}"><span>${esc(L.t('record_nav.next'))}</span>${esc(neighbours.next.name.primary)}</a>` : '<span></span>'}
    </div>
  </nav>
</main>
${foot(cfg, L)}`;
}

// --------------------------------------------------------------- about

export function aboutPage(cfg, L, view, { stories }) {
  const collection = view.collection.record;
  const items = view.entries;
  const languages = LOCALES.map((loc) => `${loc.endonym} (${loc.englishName}, ${loc.prefix === '' ? cfg.basePath : `${cfg.basePath}${loc.prefix}`})`).join('; ');

  return `${head(cfg, L, { title: L.t('page.title.about'), description: L.t('meta.about', { siteName: cfg.siteName }) })}
<body class="page page--about">
${chrome(cfg, L, { nav: 'about/', route: 'about/' })}
<main id="main">
  <header class="collection-head">
    ${trail(L, [[L.t('nav.hall'), L.path('')], [L.t('page.title.about'), null]])}
    <h1>${esc(L.t('page.title.about'))}</h1>
  </header>

  ${noticeBanner(L, L.site.buildNotice)}

  <section class="prose">
    <h2>${esc(L.t('about.name_title'))}</h2>
    <p>${fill(L.t.raw('about.name_body'), { siteName: `<strong>${esc(cfg.siteName)}</strong>` })}</p>

    <h2>${esc(L.t('about.status_title'))}</h2>
    <p>${fill(L.t.raw('about.status_body'), {
      count: String(items.length),
      collection: esc(collection.title.primary),
      sourced: String(items.filter((e) => e.record.record_class === 'sourced').length),
      practical: String(items.filter((e) => e.record.record_class === 'practical-note').length),
      fixture: String(items.filter((e) => e.record.record_class === 'fixture').length),
    })} ${esc(collection.scope_note)}</p>
    <p>${esc(L.t('about.stories_body', {
      shelf: stories.shelf.text.title,
      works: plural(L, 'about.stories_count', stories.stories.length),
    }))} ${esc(stories.shelf.text.scope_note)}</p>

    <h2>${esc(L.t('about.sourced_title'))}</h2>
    <ul>
      <li>${esc(L.t('about.sourced.cites'))}</li>
      <li>${esc(L.t('about.sourced.paraphrase'))}</li>
      <li>${esc(L.t('about.sourced.untested'))}</li>
    </ul>

    <h2>${esc(L.t('about.practical_title'))}</h2>
    <ul>
      <li>${esc(L.t('about.practical.authored'))}</li>
      <li>${esc(L.t('about.practical.nosources'))}</li>
      <li>${esc(L.t('about.practical.untested'))}</li>
    </ul>

    <h2>${esc(L.t('about.notfixture_title'))}</h2>
    <ul>
      <li>${esc(L.t('about.notfixture.sources'))}</li>
      <li>${esc(L.t('about.notfixture.claims'))}</li>
      <li>${esc(L.t('about.notfixture.tested'))}</li>
      <li>${esc(L.t('about.notfixture.images'))}</li>
      <li>${fill(L.t.raw('about.notfixture.labels'), { basis: code('label_basis') })}</li>
      <li>${esc(L.t('about.notfixture.translation'))}</li>
    </ul>

    <h2>${esc(L.t('about.languages_title'))}</h2>
    <p>${fill(L.t.raw('about.languages_body'), { langAttr: code('lang') })}</p>
    <p>${fill(L.t.raw('about.languages_persistence'), { storage: code('localStorage'), key: code(LOCALE_STORAGE_KEY) })}</p>
    <p>${esc(L.t('about.languages_fallback'))}</p>

    <h2>${esc(L.t('about.deploy_title'))}</h2>
    ${defList([
      [L.t('about.base_path'), code(cfg.basePath)],
      [L.t('about.languages_fact'), esc(languages)],
      [L.t('about.citadel'), cfg.citadel.url ? code(cfg.citadel.url) : esc(L.t('about.citadel_unset'))],
      [L.t('about.backend'), esc(L.t('about.backend_value'))],
      [L.t('about.external'), esc(L.t('about.external_value'))],
    ])}
    <p>${fill(L.t.raw('about.config_note'), { file: code('config/site.config.json') })}</p>
  </section>
</main>
${foot(cfg, L)}`;
}
