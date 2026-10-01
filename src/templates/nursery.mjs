// Agent Nursery's two pages: the collection landing, and the handbook reader.
//
// They share the site chrome and the notice banner with everything else, so the
// collection stands inside the same building rather than beside it. The
// colophon is the one piece they do not share: see nurseryFoot below. What the
// reader deliberately does not carry is everything a long text has no business
// carrying: no reading-progress meter, no estimated minutes, no "next chapter"
// rail inventing a sequel, no comment thread, no tracking, and — as everywhere
// in this build — no external asset.
//
// Two decisions shape the reader.
//
// The section anchors are the *declared* section ids, not slugs derived from
// the headings, so `#chapter-3` means the same place in the Chinese page and in
// the English one. That is what makes the language switch keep a reader's place
// in a long document; src/nursery.mjs is what guarantees the two page sets
// cannot drift apart.
//
// The manuscript's own language links — written by the authors as `[中文]
// (handbook.md)` — are resolved to the site's real routes for those locales.
// They are rendered as links to this same page in the other language, so the
// line the authors wrote still does what it says with scripting disabled.

import { esc, head, chrome, noticeBanner, trail, roomMark, ROOM } from './pages.mjs';
import { NURSERY_ROUTE, handbookRoute } from '../nursery.mjs';

const defList = (rows) => `<dl class="facts">
${rows.map(([k, v]) => `  <div class="facts__row"><dt>${esc(k)}</dt><dd>${v}</dd></div>`).join('\n')}
</dl>`;

/**
 * The authors, each linked to their own address. Names are escaped first and the
 * anchor wrapped around the escaped name, so the visible text is the name the
 * record carries whether or not a URL is configured; only https URLs are linked.
 */
const authorsHtml = (handbook) => handbook.authorship.authors.map(({ name, url }) => (
  /^https:\/\//i.test(String(url)) ? `<a href="${esc(url)}">${esc(name)}</a>` : esc(name)
)).join(' &amp; ');

// --------------------------------------------------- rendering a manuscript

/**
 * One parsed span list as HTML. Every value is escaped first and markup is
 * added afterwards, so no manuscript text can reach the page as markup — the
 * same rule the story renderer follows for an author's emphasis.
 *
 * `href` resolves a link target the authors wrote to a route this build emits.
 * src/nursery.mjs has already refused any target it cannot map, so a missing
 * one here is a programming error rather than a broken link on a page.
 */
function spansHtml(spans, href) {
  return spans.map((span) => {
    if (span.type === 'strong') return `<strong>${esc(span.text)}</strong>`;
    if (span.type === 'link') return `<a href="${esc(href(span.target))}">${esc(span.text)}</a>`;
    return esc(span.text);
  }).join('');
}

/**
 * The closing copyright line is the one place the holders are linked. The line
 * is escaped first and the anchor is wrapped around the already-escaped name,
 * so the visible text is exactly the line the authors wrote either way. Only
 * https URLs are linked, and a name already inside an anchor is not matched
 * twice.
 */
function linkHolders(html, holderLinks) {
  let out = html;
  for (const { name, url } of holderLinks) {
    const safeName = esc(name);
    if (!safeName.trim() || !/^https:\/\//i.test(String(url))) continue;
    if (out.includes(`>${safeName}</a>`)) continue;
    out = out.split(safeName).join(`<a href="${esc(url)}">${safeName}</a>`);
  }
  return out;
}

/**
 * The nursery's own colophon.
 *
 * The shared footer was written for the kitchen: it carries the recipe build's
 * mixed-sourcing notice, a rights note about cooking facts and the deployment's
 * base path. None of that says anything true about a published manuscript, so
 * these pages carry a compact footer of their own instead — one practical note
 * about what a reader is holding, the development credit, and the copyright
 * line as the last thing visible on the page.
 *
 * The copyright line itself is identical to the shared one, holder links and
 * all, and the shared browser script is kept exactly as the shared footer emits
 * it, because that is what drives the language switch in the header.
 */
export function nurseryFoot(cfg, L) {
  const holderLinks = Object.entries(cfg.copyright.links ?? {}).map(([name, url]) => ({ name, url }));
  const reserved = String(cfg.copyright.reserved ?? '').trim();
  const line = `© ${esc(String(cfg.copyright.year))} ${esc(cfg.copyright.holders)}.${reserved ? ` ${esc(reserved)}` : ''}`;
  // An unconfigured holder renders no line rather than a guessed one, the same
  // way the shared footer treats it.
  const copyright = String(cfg.copyright.holders).trim()
    ? `<p class="colophon__copyright">${linkHolders(line, holderLinks)}</p>`
    : '';
  return `<footer class="colophon colophon--nursery">
<p class="colophon__living">${esc(L.t('nursery.footer_note'))}</p>
<p class="colophon__development">Developed by Atom (原子) &amp; Claude.</p>
${copyright}
</footer>
<script src="${cfg.withBase('assets/app.js')}" defer></script>
</body>
</html>`;
}

const lineRuns = (lines, href) => lines.map((line) => spansHtml(line.spans, href)).join('<br>\n      ');

function blockHtml(block, href) {
  if (block.type === 'quote') {
    return `      <blockquote class="handbook__quote"><p>${lineRuns(block.lines, href)}</p></blockquote>`;
  }
  return `      <p>${lineRuns(block.lines, href)}</p>`;
}

/** The last paragraph of the manuscript, rendered with its holders linked. */
function closingHtml(block, href, holderLinks) {
  return `      <p class="handbook__closing">${linkHolders(lineRuns(block.lines, href), holderLinks)}</p>`;
}

function sectionHtml(section, href, holderLinks, isLast) {
  const tag = section.level === 3 ? 'h3' : 'h2';
  const body = section.blocks.map((block, i) => (
    isLast && section.subsections.length === 0 && i === section.blocks.length - 1
      ? closingHtml(block, href, holderLinks)
      : blockHtml(block, href)
  )).join('\n');

  // A level-3 section is nested inside the level-2 one that opened it, so the
  // document outline a reader's assistive technology builds is the outline the
  // contents list shows.
  const subs = section.subsections.map((sub, i) => sectionHtml(
    sub, href, holderLinks, isLast && i === section.subsections.length - 1,
  )).join('\n');

  return `    <section class="handbook__section handbook__section--${esc(section.kind)}" id="${esc(section.section_id)}" aria-labelledby="h-${esc(section.section_id)}">
      <${tag} id="h-${esc(section.section_id)}" class="handbook__heading">${spansHtml(section.heading, href)}</${tag}>
${body}${subs ? `\n${subs}` : ''}
    </section>`;
}

/**
 * The contents. It is a real list of real links to anchors on this page, so it
 * works with scripting disabled and a reader can copy a link to one chapter.
 */
function contentsHtml(L, document, href) {
  const entry = (section) => `      <li class="handbook-contents__item handbook-contents__item--${esc(section.kind)}">
        <a href="#${esc(section.section_id)}">${spansHtml(section.heading, href)}</a>${section.subsections.length ? `
        <ol class="handbook-contents__sub">
${section.subsections.map((sub) => `          <li><a href="#${esc(sub.section_id)}">${spansHtml(sub.heading, href)}</a></li>`).join('\n')}
        </ol>` : ''}
      </li>`;

  return `  <nav class="handbook-contents" aria-labelledby="handbook-contents-title">
    <h2 id="handbook-contents-title" class="handbook-contents__title">${esc(L.t('nursery.contents_title'))}</h2>
    <ol class="handbook-contents__list">
${document.sections.map(entry).join('\n')}
    </ol>
  </nav>`;
}

// ------------------------------------------------------- the landing page

export function nurseryLandingPage(cfg, L, view) {
  const { text } = view.collection;
  const collection = view.collection.record;

  const holdings = view.handbooks.map((entry) => {
    const handbook = entry.record;
    return `    <li class="holding">
      <a class="holding__link" href="${L.path(handbookRoute(handbook))}">
        <span class="holding__marks">
          <span class="card__class">${esc(L.t('nursery.handbook_mark'))}</span>
          <span class="card__untranslated">${esc(L.t('nursery.bilingual_mark'))}</span>
        </span>
        <h3 class="holding__title">${esc(entry.text.title)}${entry.text.title_alt ? `<span class="holding__alt">${esc(entry.text.title_alt)}</span>` : ''}</h3>
        <p class="holding__abstract">${esc(entry.text.abstract)}</p>
        <span class="holding__meta">
          <span>${esc(L.t('nursery.edition', { edition: handbook.edition, date: handbook.edition_date }))}</span>
          <span>${esc(L.t('nursery.by', { authors: handbook.authorship.authors.map((a) => a.name).join(' & ') }))}</span>
          <span>${esc(L.t('nursery.structure_summary', {
    chapters: handbook.structure.chapter_count,
    exercises: handbook.structure.exercise_count,
    appendices: handbook.structure.appendix_count,
  }))}</span>
        </span>
      </a>
    </li>`;
  }).join('\n');

  return `${head(cfg, L, { title: text.title, description: text.description })}
<body class="page page--nursery">
${chrome(cfg, L, { nav: NURSERY_ROUTE, route: NURSERY_ROUTE })}
<main id="main">
  <header class="collection-head collection-head--room collection-head--room-${ROOM.nursery}">
    ${trail(L, [[L.t('nav.hall'), L.path('')], [text.title, null]])}
    <p class="collection-head__room">${roomMark(L, ROOM.nursery)}</p>
    <h1>${esc(text.title)}${text.title_alt ? `<span class="collection-head__alt">${esc(text.title_alt)}</span>` : ''}</h1>
    <p class="collection-head__desc">${esc(text.description)}</p>
  </header>

  ${noticeBanner(L, text.collection_notice)}

  <section class="prose nursery-aspiration" aria-labelledby="h-aspiration">
    <h2 id="h-aspiration">${esc(text.aspiration_title)}</h2>
${text.aspiration.map((p) => `    <p>${esc(p)}</p>`).join('\n')}
  </section>

  <section class="nursery-holdings" aria-labelledby="h-holdings">
    <h2 id="h-holdings" class="section-title">${esc(text.holdings_title)}</h2>
    <p class="nursery-holdings__note">${esc(text.holdings_note)}</p>
    <ul class="holding-list">
${holdings}
    </ul>
    <p class="nursery-holdings__scope">${esc(text.scope_note)}</p>
    ${defList([
      [L.t('nursery.facts.published'), esc(L.t('nursery.facts.published_value', { count: view.handbooks.length }))],
      [L.t('nursery.facts.version'), esc(L.t('nursery.facts.version_value', { version: collection.record_version, date: collection.reviewed_at }))],
    ])}
  </section>
</main>
${nurseryFoot(cfg, L)}`;
}

// ------------------------------------------------------- the handbook reader

export function handbookPage(cfg, L, view, { entry }) {
  const handbook = entry.record;
  const { text, document } = entry;
  const collectionTitle = view.collection.text.title;
  const route = handbookRoute(handbook);

  // The authors wrote the language line as links between their own manuscript
  // files. Here those targets become the real routes for this same reader in
  // each language, so the line keeps working as written, without scripting.
  const localeOf = new Map(handbook.language_links.map((l) => [l.target, l.locale]));
  const href = (target) => {
    const locale = localeOf.get(target);
    if (!locale) throw new Error(`Unmapped manuscript link target "${target}"`);
    return L.pathIn(locale, route);
  };

  const lastSection = document.sections.length - 1;

  return `${head(cfg, L, { title: text.title, description: text.abstract })}
<body class="page page--handbook">
${chrome(cfg, L, { nav: NURSERY_ROUTE, route })}
<main id="main">
  <div class="threshold threshold--room-${ROOM.nursery}">
    ${trail(L, [
    [L.t('nav.hall'), L.path('')],
    [collectionTitle, L.path(NURSERY_ROUTE), roomMark(L, ROOM.nursery)],
    [text.title, null],
  ])}
  </div>

  ${noticeBanner(L, text.nature_note)}

  <article class="handbook">
    <header class="handbook__head">
      <p class="handbook__marks"><span class="card__class">${esc(L.t('nursery.handbook_mark'))}</span> <span class="card__untranslated">${esc(L.t('nursery.bilingual_mark'))}</span></p>
      <h1 id="handbook-title">${document.title ? spansHtml(document.title.spans, href) : esc(text.title)}</h1>
      <p class="handbook__abstract">${esc(text.abstract)}</p>
    </header>

    <div class="handbook__front">
${document.front.map((block) => blockHtml(block, href)).join('\n')}
    </div>

${contentsHtml(L, document, href)}

${document.sections.map((section, i) => sectionHtml(section, href, handbook.holder_links, i === lastSection)).join('\n')}

    <section class="record__block record__block--provenance" aria-labelledby="h-handbook-colophon">
      <h2 id="h-handbook-colophon">${esc(L.t('nursery.colophon_title'))}</h2>
      <p class="block-note">${esc(text.publication_note)}</p>
      ${defList([
        [L.t('nursery.facts.authors'), authorsHtml(handbook)],
        [L.t('nursery.facts.edition'), esc(L.t('nursery.edition', { edition: handbook.edition, date: handbook.edition_date }))],
        [L.t('nursery.facts.structure'), esc(L.t('nursery.structure_summary', {
          chapters: handbook.structure.chapter_count,
          exercises: handbook.structure.exercise_count,
          appendices: handbook.structure.appendix_count,
        }))],
        [L.t('nursery.facts.translation'), esc(text.language_note)],
        [L.t('nursery.facts.license'), esc(text.rights_note)],
      ])}
      <h3 class="subhead">${esc(L.t('detail.history_title'))}</h3>
      <ol class="history">
${handbook.change_history.map((h) => `        <li><span class="history__version">v${esc(h.version)}</span> <span class="history__date">${esc(h.date)}</span><p>${esc(h.change)}</p><p class="muted">${esc(L.t('history.supersedes', { what: h.supersedes ? `v${h.supersedes}` : L.t('history.supersedes_none') }))}</p></li>`).join('\n')}
      </ol>
    </section>
  </article>

  <nav class="story-nav" aria-label="${esc(L.t('nursery.nav_label'))}">
    <p class="story-nav__context">${esc(L.t('nursery.return_context', { count: view.handbooks.length }))}</p>
    <a class="story-nav__index" href="${L.path(NURSERY_ROUTE)}">${esc(L.t('nursery.return'))}</a>
  </nav>
</main>
${nurseryFoot(cfg, L)}`;
}
