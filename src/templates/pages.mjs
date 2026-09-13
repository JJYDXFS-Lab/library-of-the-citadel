// HTML page templates. Plain template literals — no framework, no dependency.
//
// Every internal link goes through cfg.withBase(), so the same templates emit a
// correct site at "/" and at "/any-subpath/". Detail pages are generated as real
// directories with index.html, which is what makes deep links and browser reload
// work on GitHub Pages without a server or a router.

const AMP = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };
export const esc = (value) => String(value ?? '').replace(/[&<>"']/g, (c) => AMP[c]);

const itemPath = (item) => `recipes/${item.item_id}/`;

function head(cfg, { title, description, extraCss = '' }) {
  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${esc(title)} · ${esc(cfg.siteName)}</title>
<meta name="description" content="${esc(description)}">
<meta name="robots" content="index, follow">
<link rel="stylesheet" href="${cfg.withBase('assets/site.css')}">
${extraCss}</head>`;
}

function citadelLink(cfg) {
  if (!cfg.citadel.url) {
    // No invented destination. The slot is visible but inert until configured.
    return `<span class="citadel-link citadel-link--unset" title="${esc(cfg.citadel.note)}">${esc(cfg.citadel.label)} link not configured</span>`;
  }
  return `<a class="citadel-link" href="${esc(cfg.citadel.url)}" rel="noopener">${esc(cfg.citadel.label)} →</a>`;
}

function chrome(cfg, current) {
  const nav = [
    ['', 'Hall'],
    ['recipes/', 'World Recipes'],
    ['about/', 'About this build'],
  ];
  return `<a class="skip-link" href="#main">Skip to content</a>
<header class="masthead">
<a class="wordmark" href="${cfg.withBase('')}">
  <span class="wordmark__name">${esc(cfg.siteName)}</span>
  ${cfg.siteNameAlt ? `<span class="wordmark__alt">${esc(cfg.siteNameAlt)}</span>` : ''}
</a>
<nav class="masthead__nav">
${nav.map(([href, label]) => `  <a href="${cfg.withBase(href)}"${href === current ? ' aria-current="page"' : ''}>${esc(label)}</a>`).join('\n')}
</nav>
${citadelLink(cfg)}
</header>`;
}

function foot(cfg) {
  return `<footer class="colophon">
<p class="colophon__notice">${esc(cfg.buildNotice)}</p>
<p>${esc(cfg.footerNote)}</p>
<p class="colophon__meta">Served from base path <code>${esc(cfg.basePath)}</code>.</p>
</footer>
</body>
</html>`;
}

const fixtureBanner = (text) => `<p class="fixture-banner" role="note"><span class="fixture-banner__tag">Fixture</span> ${esc(text)}</p>`;

// ---------------------------------------------------------------- hall

export function hallPage(cfg, { collection, items }) {
  return `${head(cfg, { title: 'Hall', description: `${cfg.siteName} — ${cfg.tagline}` })}
<body class="page page--hall">
${chrome(cfg, '')}
<main id="main">
  <section class="hall" aria-labelledby="hall-title">
    <div class="hall__vault" aria-hidden="true">
      <span class="hall__arch"></span><span class="hall__arch"></span><span class="hall__arch"></span>
    </div>
    <div class="hall__plaque">
      <h1 id="hall-title" class="hall__title">${esc(cfg.siteName)}${cfg.siteNameAlt ? `<span class="hall__title-alt">${esc(cfg.siteNameAlt)}</span>` : ''}</h1>
      <p class="hall__tagline">${esc(cfg.tagline)}</p>
    </div>
  </section>

  ${fixtureBanner(cfg.buildNotice)}

  <section class="shelves" aria-labelledby="shelves-title">
    <h2 id="shelves-title" class="section-title">Collections</h2>
    <ul class="shelf-list">
      <li class="shelf">
        <a class="shelf__link" href="${cfg.withBase('recipes/')}">
          <span class="shelf__spine" aria-hidden="true"></span>
          <span class="shelf__body">
            <span class="shelf__title">${esc(collection.title.primary)}${(collection.title.alt ?? []).length ? `<span class="shelf__alt">${esc(collection.title.alt[0])}</span>` : ''}</span>
            <span class="shelf__desc">${esc(collection.description)}</span>
            <span class="shelf__count">${items.length} fixture record${items.length === 1 ? '' : 's'}</span>
          </span>
        </a>
      </li>
      <li class="shelf shelf--empty" aria-disabled="true">
        <span class="shelf__spine" aria-hidden="true"></span>
        <span class="shelf__body">
          <span class="shelf__title">Further collections</span>
          <span class="shelf__desc">The hall is built to hold more than one collection. None are seeded yet, and none are implied.</span>
        </span>
      </li>
    </ul>
  </section>

  <section class="reading-room" aria-labelledby="reading-room-title">
    <h2 id="reading-room-title" class="section-title">What this build is</h2>
    <p>${esc(cfg.siteName)} is an independent, statically built Library framework: a hall, a collection gallery with search and a region filter, and one generated page per record. There is no backend and no runtime server requirement for browsing the deployed output.</p>
    <p><a class="text-link" href="${cfg.withBase('about/')}">Read the full build notes →</a></p>
  </section>
</main>
${foot(cfg)}`;
}

// ------------------------------------------------------------- gallery

function card(cfg, item) {
  return `<li class="card" data-item-id="${esc(item.item_id)}" data-region="${esc(item.region.label)}" data-haystack="${esc([item.name.primary, ...(item.name.alt ?? []), item.region.label, item.region.cuisine_label, item.summary, ...(item.tags ?? []), ...item.variants.map((v) => v.label)].join(' ').toLowerCase())}">
  <a class="card__link" href="${cfg.withBase(itemPath(item))}">
    <span class="card__marks">
      <span class="card__region">${esc(item.region.label)}</span>
      <span class="card__class">fixture</span>
    </span>
    <h3 class="card__title">${esc(item.name.primary)}</h3>
    <p class="card__summary">${esc(item.summary)}</p>
    <span class="card__meta">
      <span>${esc(item.region.cuisine_label)}</span>
      <span>${item.variants.length} variant${item.variants.length === 1 ? '' : 's'}</span>
      <span>v${esc(item.record_version)}</span>
    </span>
  </a>
</li>`;
}

export function galleryPage(cfg, { collection, items, regions }) {
  return `${head(cfg, { title: collection.title.primary, description: collection.description })}
<body class="page page--gallery">
${chrome(cfg, 'recipes/')}
<main id="main">
  <header class="collection-head">
    <p class="crumb"><a href="${cfg.withBase('')}">Hall</a> <span aria-hidden="true">/</span> ${esc(collection.title.primary)}</p>
    <h1>${esc(collection.title.primary)}${(collection.title.alt ?? []).length ? `<span class="collection-head__alt">${esc(collection.title.alt[0])}</span>` : ''}</h1>
    <p class="collection-head__desc">${esc(collection.description)}</p>
  </header>

  ${fixtureBanner(collection.record_notice)}

  <form class="filters" role="search" aria-label="Filter recipes" data-filters>
    <div class="filters__field">
      <label for="q">Search</label>
      <input type="search" id="q" name="q" autocomplete="off" placeholder="name, region, ingredient tag…" data-search>
    </div>
    <div class="filters__field">
      <label for="region">Region</label>
      <select id="region" name="region" data-region>
        <option value="">All regions</option>
${regions.map((r) => `        <option value="${esc(r)}">${esc(r)}</option>`).join('\n')}
      </select>
    </div>
    <button type="button" class="filters__reset" data-reset hidden>Clear</button>
    <p class="filters__status" aria-live="polite" data-status>Showing all ${items.length} records.</p>
  </form>

  <ul class="card-grid" data-grid>
${items.map((item) => card(cfg, item)).join('\n')}
  </ul>

  <div class="empty-state" data-empty hidden>
    <p class="empty-state__title">No records match that.</p>
    <p>This collection holds only ${items.length} illustrative fixture records, so most searches will come up empty. That is the collection being small, not the search being broken.</p>
    <p class="empty-state__hint">Try clearing the region filter, searching a shorter word, or <button type="button" class="text-link" data-reset-inline>reset both filters</button>.</p>
  </div>

  <noscript>
    <p class="noscript-note">Search and filtering need JavaScript. Every record below is still reachable as its own page, and every link on this site works with scripting disabled.</p>
  </noscript>
</main>
<script src="${cfg.withBase('assets/app.js')}" defer></script>
${foot(cfg)}`;
}

// -------------------------------------------------------------- detail

const defList = (rows) => `<dl class="facts">
${rows.map(([k, v]) => `  <div class="facts__row"><dt>${esc(k)}</dt><dd>${v}</dd></div>`).join('\n')}
</dl>`;

export function detailPage(cfg, { collection, item, neighbours }) {
  const sources = item.sources.length
    ? `<ul class="sources">${item.sources.map((s) => `<li><a href="${esc(s.url)}" rel="noopener">${esc(s.title)}</a> <span class="sources__date">accessed ${esc(s.accessed_at)}</span>${s.note ? `<p class="sources__note">${esc(s.note)}</p>` : ''}</li>`).join('')}</ul>`
    : `<p class="sources sources--none">No sources recorded. <span class="muted">${esc(item.provenance_note)}</span></p>`;

  return `${head(cfg, { title: item.name.primary, description: item.summary })}
<body class="page page--detail">
${chrome(cfg, 'recipes/')}
<main id="main">
  <p class="crumb"><a href="${cfg.withBase('')}">Hall</a> <span aria-hidden="true">/</span> <a href="${cfg.withBase('recipes/')}">${esc(collection.title.primary)}</a> <span aria-hidden="true">/</span> ${esc(item.name.primary)}</p>

  ${fixtureBanner(item.record_notice)}

  <article class="record">
    <header class="record__head">
      <p class="record__marks"><span class="card__region">${esc(item.region.label)}</span> <span class="card__class">fixture</span></p>
      <h1>${esc(item.name.primary)}</h1>
      ${(item.name.alt ?? []).length ? `<p class="record__alt">${esc(item.name.alt.join(' · '))}</p>` : ''}
      <p class="record__summary">${esc(item.summary)}</p>
    </header>

    <section class="record__block" aria-labelledby="h-variants">
      <h2 id="h-variants">Regional variants</h2>
      <p class="block-note">Variants are held side by side. The record does not nominate one of them as the definitive version.</p>
      <ul class="variants">
${item.variants.map((v) => `        <li class="variant"><p class="variant__label">${esc(v.label)}</p><p class="variant__region">${esc(v.region_label)}</p><p>${esc(v.difference_note)}</p></li>`).join('\n')}
      </ul>
    </section>

    <div class="record__columns">
      <section class="record__block" aria-labelledby="h-ingredients">
        <h2 id="h-ingredients">Ingredients</h2>
        <ul class="ingredients">
${item.ingredients.map((g) => `          <li><span class="ingredients__qty">${esc(g.quantity ?? '')}</span> <span class="ingredients__item">${esc(g.item)}</span>${g.note ? `<span class="ingredients__note">${esc(g.note)}</span>` : ''}</li>`).join('\n')}
        </ul>
        ${item.yield_note ? `<p class="yield">Yield: ${esc(item.yield_note)}</p>` : ''}
      </section>

      <section class="record__block" aria-labelledby="h-method">
        <h2 id="h-method">Method</h2>
        <ol class="method">
${item.method.map((m) => `          <li>${esc(m.instruction)}</li>`).join('\n')}
        </ol>
      </section>
    </div>

    <section class="record__block record__block--caution" aria-labelledby="h-safety">
      <h2 id="h-safety">Safety caveats</h2>
      <ul class="caveats">${item.safety.caveats.map((c) => `<li>${esc(c)}</li>`).join('')}</ul>
      <p class="block-note">Safety review state: <code>${esc(item.safety.review_state)}</code></p>
    </section>

    <section class="record__block record__block--provenance" aria-labelledby="h-provenance">
      <h2 id="h-provenance">Provenance, version and rights</h2>
      ${defList([
        ['Item ID', `<code>${esc(item.item_id)}</code>`],
        ['Collection', `<code>${esc(item.collection_id)}</code>`],
        ['Record class', `<code>${esc(item.record_class)}</code> — ${item.publication_ready ? 'publication-ready' : 'not publication-ready'}`],
        ['Region label basis', `<code>${esc(item.region.label_basis)}</code> — a presentation facet, not an attribution claim`],
        ['Sources', sources],
        ['Source state', `<code>${esc(item.source_state)}</code>`],
        ['Reviewed', esc(item.reviewed_at)],
        ['Record version', `<code>${esc(item.record_version)}</code>`],
        ['Content licence', `${esc(item.rights.content_license)} <span class="muted">(review state <code>${esc(item.rights.license_review_state)}</code>)</span>`],
        ['Image rights', `<code>${esc(item.rights.image_rights_review_state)}</code> — ${item.rights.images.length} image(s) in record`],
      ])}
      <h3 class="subhead">Change history</h3>
      <ol class="history">
${item.change_history.map((h) => `        <li><span class="history__version">v${esc(h.version)}</span> <span class="history__date">${esc(h.date)}</span><p>${esc(h.change)}</p><p class="muted">Supersedes: ${h.supersedes ? `v${esc(h.supersedes)}` : 'nothing — initial entry'}</p></li>`).join('\n')}
      </ol>
    </section>
  </article>

  <nav class="record-nav" aria-label="Other records in this collection">
    ${neighbours.prev ? `<a class="record-nav__prev" href="${cfg.withBase(itemPath(neighbours.prev))}"><span>Previous</span>${esc(neighbours.prev.name.primary)}</a>` : '<span></span>'}
    <a class="record-nav__index" href="${cfg.withBase('recipes/')}">All records</a>
    ${neighbours.next ? `<a class="record-nav__next" href="${cfg.withBase(itemPath(neighbours.next))}"><span>Next</span>${esc(neighbours.next.name.primary)}</a>` : '<span></span>'}
  </nav>
</main>
${foot(cfg)}`;
}

// --------------------------------------------------------------- about

export function aboutPage(cfg, { collection, items }) {
  return `${head(cfg, { title: 'About this build', description: `How this ${cfg.siteName} build is configured and what its content status is.` })}
<body class="page page--about">
${chrome(cfg, 'about/')}
<main id="main">
  <header class="collection-head">
    <p class="crumb"><a href="${cfg.withBase('')}">Hall</a> <span aria-hidden="true">/</span> About this build</p>
    <h1>About this build</h1>
  </header>

  ${fixtureBanner(cfg.buildNotice)}

  <section class="prose">
    <h2>Name</h2>
    <p>The official name of this project is <strong>${esc(cfg.siteName)}</strong>. It is a distinct project from
      Atom-KB's separate Library: the two hold different content in different stores, and this build neither
      mirrors, syncs, nor supersedes Atom-KB's. A link between them, if one is ever configured, is a pointer and
      not a source-of-truth relationship.</p>

    <h2>Content status</h2>
    <p>This deployment contains ${items.length} records in ${esc(collection.title.primary)}, all of record class <code>fixture</code>. ${esc(collection.scope_note)}</p>

    <h2>What a fixture record is not</h2>
    <ul>
      <li>It is not researched, and it carries no source URLs. The source list is empty rather than filled with a placeholder.</li>
      <li>It makes no claim about the history, origin, authenticity, or regional ownership of any dish.</li>
      <li>It has not been cooked or tested, and no outcome is reported.</li>
      <li>It contains no images, and its image-rights review state says so explicitly.</li>
      <li>Region and cuisine labels on fixture records exist to exercise the filter interface. Their <code>label_basis</code> field records that they are illustrative.</li>
    </ul>

    <h2>Deployment configuration</h2>
    ${defList([
      ['Base path', `<code>${esc(cfg.basePath)}</code>`],
      ['Citadel link', cfg.citadel.url ? `<code>${esc(cfg.citadel.url)}</code>` : 'not configured — the header slot renders inert'],
      ['Backend', 'none; the deployed site is static files only'],
      ['External requests', 'none; no fonts, images, analytics, or third-party scripts are fetched'],
    ])}
    <p>The base path and the Citadel link are set in <code>config/site.config.json</code>, and either can be overridden by environment variable at build time. No repository name or host is compiled into the source.</p>
  </section>
</main>
${foot(cfg)}`;
}
