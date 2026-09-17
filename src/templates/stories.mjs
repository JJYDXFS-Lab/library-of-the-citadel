// The story shelf's two pages: the shelf index, and one quiet reading page.
//
// They share the site chrome, the colophon and the notice banner with the
// knowledge pages, so a story sits inside the same building rather than beside
// it. What they deliberately do not share is everything a reading page has no
// business carrying: there is no timeline, no reader metric, no comment thread,
// no tracking, nothing that autoplays, and — as everywhere in this build — no
// external asset. A reader gets the title, who wrote it, what kind of text it
// is, the text, where it came from, and the way back to the shelf.
//
// The one number the reading page ends on is the shelf's own census — how many
// works a reader can open from here — which is the same count the shelf index
// shows. It is the honest return context for a shelf holding a single work:
// there is no next story, so none is invented.
//
// The body is rendered from the record's plain block list. A story's canonical
// language is the same in every locale, so the body is marked with its own
// `lang` and is never translated; the metadata around it is the reader's.

import { esc, fill, code, plural, head, chrome, foot, noticeBanner, trail, roomMark, ROOM } from './pages.mjs';
import { storyRoute, STORIES_ROUTE } from '../stories.mjs';

const defList = (rows) => `<dl class="facts">
${rows.map(([k, v]) => `  <div class="facts__row"><dt>${esc(k)}</dt><dd>${v}</dd></div>`).join('\n')}
</dl>`;

/**
 * Escape the text, then wrap the author's emphasized phrases in <strong>. The
 * phrases are escaped the same way before matching, so no record value can
 * reach the page as markup. src/stories.mjs refuses a phrase that does not
 * occur in the block, which is what keeps this from silently doing nothing.
 */
function inline(text, emphasis = []) {
  let html = esc(text);
  for (const phrase of emphasis) {
    const safe = esc(phrase);
    if (!safe.trim()) continue;
    html = html.split(safe).join(`<strong>${safe}</strong>`);
  }
  return html;
}

/** One body block. A verse keeps its stanzas and its line breaks as written. */
function block(part) {
  if (part.type === 'verse') {
    const stanzas = part.stanzas.map((lines) => `    <p>${lines.map((line) => inline(line, part.emphasis)).join('<br>\n    ')}</p>`).join('\n');
    return `  <blockquote class="story__verse">\n${stanzas}\n  </blockquote>`;
  }
  return `  <p>${inline(part.text, part.emphasis)}</p>`;
}

// ---------------------------------------------------------- the shelf

export function storiesShelfPage(cfg, L, view) {
  const { text } = view.shelf;
  const entries = view.stories.map((entry) => {
    const story = entry.record;
    return `    <li class="story-card">
      <a class="story-card__link" href="${L.path(storyRoute(story))}">
        <span class="story-card__marks">
          <span class="card__class">${esc(L.t('story.mark'))}</span>
          <span class="card__untranslated">${esc(L.t('story.original_mark'))}</span>
        </span>
        <h3 class="story-card__title">${esc(entry.text.title)}</h3>
        <p class="story-card__original" lang="${esc(story.title.canonical_language)}">${esc(L.t('story.original_title_label'))}: ${esc(story.title.canonical)}</p>
        <p class="story-card__abstract">${esc(entry.text.abstract)}</p>
        <span class="story-card__meta">
          <span>${esc(L.t('story.by', { author: story.authorship.author.name }))}</span>
          <span>${esc(L.t('story.first_published', { date: story.first_published }))}</span>
          <span>v${esc(story.record_version)}</span>
        </span>
      </a>
    </li>`;
  }).join('\n');

  return `${head(cfg, L, { title: text.title, description: text.description })}
<body class="page page--stories">
${chrome(cfg, L, { nav: 'stories/', route: STORIES_ROUTE })}
<main id="main">
  <header class="collection-head collection-head--room collection-head--room-${ROOM.stories}">
    ${trail(L, [[L.t('nav.hall'), L.path('')], [text.title, null]])}
    <p class="collection-head__room">${roomMark(L, ROOM.stories)}</p>
    <h1>${esc(text.title)}${text.title_alt ? `<span class="collection-head__alt">${esc(text.title_alt)}</span>` : ''}</h1>
    <p class="collection-head__desc">${esc(text.description)}</p>
  </header>

  ${noticeBanner(L, text.shelf_notice)}

  <p class="story-shelf__count">${esc(plural(L, 'stories.count', view.stories.length))}</p>

  <ul class="story-list">
${entries}
  </ul>

  <p class="story-shelf__scope">${esc(text.scope_note)}</p>
</main>
${foot(cfg, L)}`;
}

// -------------------------------------------------------- the reading page

export function storyPage(cfg, L, view, { entry }) {
  const story = entry.record;
  const { text } = entry;
  const shelfTitle = view.shelf.text.title;
  const author = story.authorship.author.name;

  return `${head(cfg, L, { title: text.title, description: text.abstract })}
<body class="page page--story">
${chrome(cfg, L, { nav: 'stories/', route: storyRoute(story) })}
<main id="main">
  <div class="threshold threshold--room-${ROOM.stories}">
    ${trail(L, [
    [L.t('nav.hall'), L.path('')],
    [shelfTitle, L.path(STORIES_ROUTE), roomMark(L, ROOM.stories)],
    [text.title, null],
  ])}
  </div>

  ${noticeBanner(L, text.genre_note)}

  <article class="story">
    <header class="story__head">
      <p class="story__marks"><span class="card__class">${esc(L.t('story.mark'))}</span> <span class="card__untranslated">${esc(L.t('story.original_mark'))}</span></p>
      <h1 id="story-title">${esc(text.title)}</h1>
      <p class="story__original" lang="${esc(story.title.canonical_language)}">${esc(L.t('story.original_title_label'))}: ${esc(story.title.canonical)}</p>
      <p class="story__byline">${esc(L.t('story.by', { author }))}</p>
      <p class="story__abstract">${esc(text.abstract)}</p>
      <p class="story__language-note">${esc(text.body_language_note)}</p>
    </header>

    <section class="story__body" aria-labelledby="story-title" lang="${esc(story.body_language)}">
${story.body.map(block).join('\n')}
    </section>

    <section class="record__block record__block--provenance" aria-labelledby="h-story-colophon">
      <h2 id="h-story-colophon">${esc(L.t('story.colophon_title'))}</h2>
      <p class="block-note">${esc(text.publication_note)}</p>
      ${defList([
        [L.t('story.facts.story_id'), code(story.story_id)],
        [L.t('story.facts.shelf'), code(story.shelf_id)],
        [L.t('story.facts.record_class'), `${code(story.record_class)} — ${esc(L.t('story.facts.class_note'))}`],
        [L.t('story.facts.author'), esc(author)],
        [L.t('story.facts.acknowledgement'), esc(text.acknowledgement)],
        [L.t('story.facts.body_language'), `${code(story.body_language)} — ${esc(text.body_language_note)}`],
        [L.t('story.facts.origin'), `${code(story.provenance.origin)} — ${esc(L.t('story.facts.origin_note'))}`],
        [L.t('story.facts.first_published'), esc(story.first_published)],
        [L.t('story.facts.reviewed'), esc(story.reviewed_at)],
        [L.t('story.facts.version'), code(story.record_version)],
        [L.t('story.facts.blocks'), esc(L.t('story.facts.blocks_value', { count: story.body_block_count }))],
        [L.t('story.facts.license'), `${esc(text.rights_note)} <span class="muted">${fill(L.t.raw('facts.license_review'), { state: code(story.rights.license_review_state) })}</span>`],
      ])}
      <h3 class="subhead">${esc(L.t('detail.history_title'))}</h3>
      <ol class="history">
${story.change_history.map((h) => `        <li><span class="history__version">v${esc(h.version)}</span> <span class="history__date">${esc(h.date)}</span><p>${esc(h.change)}</p><p class="muted">${esc(L.t('history.supersedes', { what: h.supersedes ? `v${h.supersedes}` : L.t('history.supersedes_none') }))}</p></li>`).join('\n')}
      </ol>
    </section>
  </article>

  <nav class="story-nav" aria-label="${esc(L.t('story.nav_label'))}">
    <p class="story-nav__context">${esc(plural(L, 'stories.count', view.stories.length))}</p>
    <a class="story-nav__index" href="${L.path(STORIES_ROUTE)}">${esc(L.t('story.return'))}</a>
  </nav>
</main>
${foot(cfg, L)}`;
}
