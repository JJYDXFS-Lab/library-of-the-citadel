// Gallery search and region filter. Progressive enhancement only: with this
// script absent, every card is still rendered and every link still resolves.
(function () {
  'use strict';

  var form = document.querySelector('[data-filters]');
  var grid = document.querySelector('[data-grid]');
  if (!form || !grid) return;

  var search = form.querySelector('[data-search]');
  var region = form.querySelector('[data-region]');
  var status = form.querySelector('[data-status]');
  var reset = form.querySelector('[data-reset]');
  var empty = document.querySelector('[data-empty]');
  var cards = Array.prototype.slice.call(grid.querySelectorAll('.card'));

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
    window.history.replaceState(null, '', qs ? '?' + qs : window.location.pathname);
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
      status.textContent = 'Showing all ' + cards.length + ' records.';
    } else if (shown === 0) {
      status.textContent = 'No records match.';
    } else {
      status.textContent = 'Showing ' + shown + ' of ' + cards.length + ' records.';
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
