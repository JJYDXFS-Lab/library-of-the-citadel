// Gallery search/region filter, and the language switch. Progressive
// enhancement only: with this script absent, every card is still rendered,
// every link still resolves, and the language switch is still two real links.
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
  var status = form.querySelector('[data-status]');
  var reset = form.querySelector('[data-reset]');
  var empty = document.querySelector('[data-empty]');
  var cards = Array.prototype.slice.call(grid.querySelectorAll('.card'));

  // Status templates come from the page, so their language matches the page's.
  var STATUS_ALL = form.getAttribute('data-status-all');
  var STATUS_SOME = form.getAttribute('data-status-some');
  var STATUS_NONE = form.getAttribute('data-status-none');

  // Filters live in the query string so a filtered view can be shared and
  // survives reload. No history entry per keystroke — replaceState only.
  function readUrl() {
    var params = new URLSearchParams(window.location.search);
    search.value = params.get('q') || '';
    region.value = params.get('region') || '';
    if (region.selectedIndex < 0) region.value = '';
  }

  function writeUrl() {
    var params = new URLSearchParams();
    if (search.value.trim()) params.set('q', search.value.trim());
    if (region.value) params.set('region', region.value);
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
    var q = search.value.trim().toLowerCase();
    var r = region.value;
    var shown = 0;

    cards.forEach(function (card) {
      var matchesQuery = !q || card.getAttribute('data-haystack').indexOf(q) !== -1;
      var matchesRegion = !r || card.getAttribute('data-region') === r;
      var visible = matchesQuery && matchesRegion;
      card.hidden = !visible;
      if (visible) shown += 1;
    });

    var filtering = Boolean(q || r);
    empty.hidden = shown !== 0;
    grid.hidden = shown === 0;
    reset.hidden = !filtering;

    if (!filtering) {
      status.textContent = fill(STATUS_ALL, { total: cards.length });
    } else if (shown === 0) {
      status.textContent = STATUS_NONE;
    } else {
      status.textContent = fill(STATUS_SOME, { shown: shown, total: cards.length });
    }

    writeUrl();
  }

  function clearAll() {
    search.value = '';
    region.value = '';
    apply();
    search.focus();
  }

  form.addEventListener('submit', function (e) { e.preventDefault(); });
  search.addEventListener('input', apply);
  region.addEventListener('change', apply);
  reset.addEventListener('click', clearAll);

  var inlineReset = document.querySelector('[data-reset-inline]');
  if (inlineReset) inlineReset.addEventListener('click', clearAll);

  readUrl();
  apply();
})();
