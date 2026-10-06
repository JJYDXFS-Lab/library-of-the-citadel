// Gallery search/facets, and the language switch. Progressive
// enhancement only: with this script absent, every card is still rendered,
// every link still resolves, the collection lenses are still real links to the
// catalogue, and the language switch is still two real links.
(function () {
  'use strict';

  function fill(template, vars) {
    return String(template).replace(/\{(\w+)\}/g, function (match, name) {
      return Object.prototype.hasOwnProperty.call(vars, name) ? vars[name] : match;
    });
  }

  // ------------------------------------------------------ language switch

  // Refreshes the switch hrefs from the live URL; a no-op on a page that has no
  // switch. The gallery filter calls it whenever it rewrites the query.
  var refreshLocaleLinks = (function localeSwitch() {
    var noop = function () {};
    var box = document.querySelector('[data-locale-switch]');
    if (!box) return noop;

    var current = box.getAttribute('data-locale-current');
    var key = box.getAttribute('data-locale-key');
    var links = Array.prototype.slice.call(box.querySelectorAll('[data-locale-code]'));

    // Storage can be absent, full, or refused (private browsing, a sandboxed
    // document, a user setting). Probe with a real write: the switch then still
    // works for this visit and simply does not persist.
    var store = (function () {
      try {
        var probe = key + '.probe';
        window.localStorage.setItem(probe, '1');
        window.localStorage.removeItem(probe);
        return window.localStorage;
      } catch (e) {
        return null;
      }
    })();

    // Carry an active search, region filter and fragment across the switch, so
    // changing language does not silently reset the view. The page-emitted href
    // is kept as the immutable base: the query and fragment are re-read from the
    // live URL every time, because filtering after load rewrites the query and
    // the reader can change the fragment at any point.
    var targets = links.map(function (link) {
      return { link: link, base: link.getAttribute('href') };
    });

    function refresh() {
      var suffix = window.location.search + window.location.hash;
      targets.forEach(function (t) { t.link.setAttribute('href', t.base + suffix); });
    }
    refresh();

    targets.forEach(function (t) {
      // Refreshed once more at click time, so a fragment or filter that changed
      // between the last refresh and the click still travels with the switch.
      // Mutating the href inside the click handler retargets this navigation;
      // the link keeps working normally, with no preventDefault and no
      // scripted navigation.
      t.link.addEventListener('click', function () {
        refresh();
        if (store) {
          try { store.setItem(key, t.link.getAttribute('data-locale-code')); } catch (e) { /* not persisted */ }
        }
      });
    });

    if (!store) return refresh;
    var preferred;
    try { preferred = store.getItem(key); } catch (e) { return refresh; }
    if (!preferred || preferred === current) return refresh;

    var match = links.filter(function (link) {
      return link.getAttribute('data-locale-code') === preferred;
    })[0];
    // Only ever redirect to an href this page itself emitted, and only by
    // replacing the entry, so there is no invented route and no back-button
    // trap. The target page's own locale matches the preference, so it cannot
    // redirect again.
    if (match) window.location.replace(match.getAttribute('href'));
    return refresh;
  })();

  // ------------------------------------------------------- gallery filter

  var form = document.querySelector('[data-filters]');
  var grid = document.querySelector('[data-grid]');
  if (!form || !grid) return;

  var search = form.querySelector('[data-search]');
  var region = form.querySelector('[data-region]');
  var method = form.querySelector('[data-method]');
  var sourceType = form.querySelector('[data-class]');
  var ingredient = form.querySelector('[data-ingredient]');
  var status = form.querySelector('[data-status]');
  var reset = form.querySelector('[data-reset]');
  var empty = document.querySelector('[data-empty]');
  var cards = Array.prototype.slice.call(grid.querySelectorAll('.card'));

  // Curated lenses. Each affordance names the section_id it narrows to; the
  // cards carry their own membership. Nothing here knows which sections the
  // collection happens to declare.
  var lensLinks = Array.prototype.slice.call(document.querySelectorAll('[data-lens-filter]'));
  var lensIds = lensLinks.map(function (link) { return link.getAttribute('data-lens-filter'); });
  var section = '';

  function memberOf(card, id) {
    var own = (card.getAttribute('data-sections') || '').split(/\s+/);
    return own.indexOf(id) !== -1;
  }

  function markLenses() {
    lensLinks.forEach(function (link) {
      if (link.getAttribute('data-lens-filter') === section) link.setAttribute('aria-current', 'true');
      else link.removeAttribute('aria-current');
    });
  }

  // Status templates come from the page, so their language matches the page's.
  var STATUS_ALL = form.getAttribute('data-status-all');
  var STATUS_SOME = form.getAttribute('data-status-some');
  var STATUS_NONE = form.getAttribute('data-status-none');
  var STATUS_FIXTURES_HIDDEN = form.getAttribute('data-status-fixtures-hidden');
  var ACTIVE_FILTERS_TEMPLATE = form.getAttribute('data-active-filters-template');
  var FIXTURE_COUNT = Number(form.getAttribute('data-fixture-count')) || 0;
  var activeFilters = document.querySelector('[data-active-filters]');

  function normalize(value) {
    return String(value || '').toLowerCase().replace(/[-‐-―]+/g, ' ').replace(/\s+/g, ' ').trim();
  }

  // Query aliases are directional. A broad fish query may include salmon, but
  // a precise salmon query should not broaden into every fish recipe.
  var aliases = {
    'lamb': ['lamb', '羊肉'],
    '羊肉': ['lamb', '羊肉'],
    'shoulder': ['shoulder', '羊肩'],
    '羊肩': ['shoulder', '羊肩'],
    'oven': ['oven', '烤箱'],
    '烤箱': ['oven', '烤箱'],
    'airfryer': ['airfryer', 'air fryer', '空气炸锅'],
    '空气炸锅': ['airfryer', 'air fryer', '空气炸锅'],
    'chicken': ['chicken', '鸡肉'],
    '鸡肉': ['chicken', '鸡肉'],
    'fish': ['fish', 'salmon', '鱼', '三文鱼'],
    '鱼': ['fish', 'salmon', '鱼', '三文鱼'],
    'salmon': ['salmon', '三文鱼'],
    '三文鱼': ['salmon', '三文鱼'],
    'potato': ['potato', '土豆'],
    '土豆': ['potato', '土豆'],
  };

  function queryTokens(value) {
    // Treat the spaced and hyphenated spellings as the same single concept so
    // "air fryer", "air-fryer", and "airfryer" behave identically.
    var normalized = normalize(value).replace(/\bair\s+fryer\b/g, 'airfryer');
    return normalized ? normalized.split(/\s+/) : [];
  }

  function matchesQuery(card, tokens) {
    var haystack = normalize(card.getAttribute('data-haystack'));
    return tokens.every(function (token) {
      if (token === 'salmon' || token === '三文鱼') return memberOfList(card, 'data-tags', 'salmon');
      return (aliases[token] || [token]).some(function (term) {
        return haystack.indexOf(normalize(term)) !== -1;
      });
    });
  }

  function memberOfList(card, attr, value) {
    if (!value) return true;
    return (card.getAttribute(attr) || '').split(/\s+/).indexOf(value) !== -1;
  }

  function readSelect(params, name, select) {
    select.value = params.get(name) || '';
    if (select.selectedIndex < 0) select.value = '';
  }

  function selectedText(select) {
    return select.value && select.selectedIndex >= 0 ? select.options[select.selectedIndex].text : '';
  }

  function labelText(id) {
    var label = form.querySelector('label[for="' + id + '"]');
    return label ? label.textContent : id;
  }

  function activeFilterLabels(tokens) {
    var labels = [];
    if (tokens.length) labels.push(labelText('q') + ': ' + search.value.trim());
    if (region.value) labels.push(labelText('region') + ': ' + selectedText(region));
    if (method.value) labels.push(labelText('method') + ': ' + selectedText(method));
    if (sourceType.value) labels.push(labelText('class') + ': ' + selectedText(sourceType));
    if (ingredient.value) labels.push(labelText('ingredient') + ': ' + selectedText(ingredient));
    if (section) {
      var lens = lensLinks.filter(function (link) { return link.getAttribute('data-lens-filter') === section; })[0];
      labels.push(lens ? lens.textContent.trim() : section);
    }
    return labels;
  }

  // Filters live in the query string so a filtered view can be shared and
  // survives reload. No history entry per keystroke — replaceState only.
  function readUrl() {
    var params = new URLSearchParams(window.location.search);
    search.value = params.get('q') || '';
    readSelect(params, 'region', region);
    readSelect(params, 'method', method);
    readSelect(params, 'class', sourceType);
    readSelect(params, 'ingredient', ingredient);
    // A section this page does not offer is dropped, the same way a region that
    // is not an option is, rather than silently hiding every card.
    section = params.get('section') || '';
    if (lensIds.indexOf(section) === -1) section = '';
  }

  function writeUrl() {
    var params = new URLSearchParams();
    if (search.value.trim()) params.set('q', search.value.trim());
    if (region.value) params.set('region', region.value);
    if (section) params.set('section', section);
    if (method.value) params.set('method', method.value);
    if (sourceType.value) params.set('class', sourceType.value);
    if (ingredient.value) params.set('ingredient', ingredient.value);
    var qs = params.toString();
    // The fragment is not ours to drop: it may be a skip-link target or an
    // in-page anchor the reader arrived on, and losing it on the first
    // keystroke would silently change where the page points.
    var hash = window.location.hash;
    window.history.replaceState(null, '', (qs ? '?' + qs : window.location.pathname) + hash);
    // Filtering rewrote the query, so the language switch has to follow it.
    refreshLocaleLinks();
  }

  function apply() {
    var tokens = queryTokens(search.value);
    var r = region.value;
    var m = method.value;
    var c = sourceType.value;
    var i = ingredient.value;
    var foodFacet = Boolean(m || i);
    var shown = 0;

    cards.forEach(function (card) {
      var queryMatch = matchesQuery(card, tokens);
      var matchesRegion = !r || card.getAttribute('data-region') === r;
      var matchesSection = !section || memberOf(card, section);
      var matchesMethod = !m || card.getAttribute('data-method') === m;
      var matchesClass = !c || card.getAttribute('data-class') === c;
      var matchesIngredient = memberOfList(card, 'data-ingredients', i);
      // Fixture tags illustrate the schema rather than recommending food. A
      // food facet therefore suppresses fixtures unless the fixture class was
      // itself explicitly requested; the class/method/ingredient tests still
      // intersect normally after that policy gate.
      var fixtureAllowed = card.getAttribute('data-class') !== 'fixture' || !foodFacet || c === 'fixture';
      var visible = queryMatch && matchesRegion && matchesSection && matchesMethod
        && matchesClass && matchesIngredient && fixtureAllowed;
      card.hidden = !visible;
      if (visible) shown += 1;
    });

    markLenses();
    var filtering = Boolean(tokens.length || r || section || m || c || i);
    var fixtureNote = foodFacet && !c && FIXTURE_COUNT
      ? ' ' + fill(STATUS_FIXTURES_HIDDEN, { count: FIXTURE_COUNT }) : '';
    var labels = activeFilterLabels(tokens);
    empty.hidden = shown !== 0;
    grid.hidden = shown === 0;
    reset.hidden = !filtering;
    if (activeFilters) {
      activeFilters.hidden = !filtering;
      activeFilters.textContent = filtering ? fill(ACTIVE_FILTERS_TEMPLATE, { filters: labels.join(' · ') }) : '';
    }

    if (!filtering) {
      status.textContent = fill(STATUS_ALL, { total: cards.length });
    } else if (shown === 0) {
      status.textContent = STATUS_NONE + fixtureNote;
    } else {
      status.textContent = fill(STATUS_SOME, { shown: shown, total: cards.length }) + fixtureNote;
    }

    writeUrl();
  }

  function clearAll() {
    search.value = '';
    region.value = '';
    method.value = '';
    sourceType.value = '';
    ingredient.value = '';
    section = '';
    apply();
    search.focus();
  }

  form.addEventListener('submit', function (e) { e.preventDefault(); });
  search.addEventListener('input', apply);
  region.addEventListener('change', apply);
  method.addEventListener('change', apply);
  sourceType.addEventListener('change', apply);
  ingredient.addEventListener('change', apply);
  reset.addEventListener('click', clearAll);

  // The lens link already points at this page with its section in the query, so
  // it works with no script at all. With the script, the same activation is
  // handled in place: the catalogue narrows, the query is rewritten, and the
  // live status line announces the new count. The reset control clears it along
  // with the other two filters.
  lensLinks.forEach(function (link) {
    link.addEventListener('click', function (e) {
      e.preventDefault();
      section = link.getAttribute('data-lens-filter');
      apply();
      if (typeof form.scrollIntoView === 'function') form.scrollIntoView();
    });
  });

  var inlineReset = document.querySelector('[data-reset-inline]');
  if (inlineReset) inlineReset.addEventListener('click', clearAll);

  readUrl();
  apply();
})();
