/* Library of the Citadel — margin ornament.
 *
 * An original, browser-side botanical mark for reading pages. It measures the
 * page's real text lines, images, cards and controls, marks a padded area
 * around each, finds the largest remaining holes on a bounded grid, and grows a
 * sparse branch from the page edge (or from a branch already drawn) to each
 * hole it chooses, with a few leaves on the way and a small bloom in the hole.
 *
 * The approach — free-space radii on a grid, largest holes first, branches
 * grown towards them, seeded per page — is inspired by Kevin Raymond's
 * Florilegium (MIT, 2026). No Florilegium source, genome, renderer or art is
 * used here, and this is far simpler than it.
 *
 * Purely decorative: aria-hidden, no pointer events, no animation, hidden in
 * print, absent without JavaScript. Work is finite: grid cells, branch length,
 * SVG nodes and measured elements are all capped, and it only re-runs on a
 * debounced resize, font load or image load — never from observing itself.
 */
(function (root) {
  'use strict';

  var LIMITS = { maxCells: 14000, maxNodes: 160, maxElements: 800, maxRects: 3000, pad: 14, cell: 16 };

  function hashString(s) {
    var h = 2166136261 >>> 0;
    for (var i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619) >>> 0; }
    return h >>> 0;
  }

  function rng(seed) {
    var a = seed >>> 0;
    return function () {
      a = (a + 0x6D2B79F5) >>> 0;
      var t = a;
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  // Density follows the viewport, but every size runs the same measurement: a
  // narrow page is decorated only where its own whitespace is large enough.
  function settingsFor(vw) {
    if (vw < 700) return { minR: 4, maxBlooms: 2, leafEvery: 6, spacing: 14 };
    if (vw < 1000) return { minR: 3, maxBlooms: 4, leafEvery: 5, spacing: 12 };
    return { minR: 3, maxBlooms: 8, leafEvery: 4, spacing: 12 };
  }

  // Clearance grid: 0 inside a padded obstacle, otherwise the approximate
  // distance in cells to the nearest blocked cell or the region's edge.
  function buildGrid(w, h, obstacles, pad) {
    var cell = LIMITS.cell;
    while (Math.floor(w / cell) * Math.floor(h / cell) > LIMITS.maxCells) cell += 4;
    var cols = Math.max(1, Math.floor(w / cell)), rows = Math.max(1, Math.floor(h / cell));
    var d = new Float32Array(cols * rows).fill(1e9);
    for (var k = 0; k < obstacles.length; k++) {
      var o = obstacles[k];
      // Conservative: any cell whose square touches the padded rectangle is
      // blocked, so a free cell's whole square (and a step between two free
      // neighbours) stays at least `pad` from every obstacle at any cell size.
      var x0 = Math.max(0, Math.floor((o.x - pad) / cell));
      var x1 = Math.min(cols - 1, Math.floor((o.x + o.w + pad) / cell));
      var y0 = Math.max(0, Math.floor((o.y - pad) / cell));
      var y1 = Math.min(rows - 1, Math.floor((o.y + o.h + pad) / cell));
      for (var y = y0; y <= y1; y++) for (var x = x0; x <= x1; x++) d[y * cols + x] = 0;
    }
    var D = 1.414;
    function at(x, y) { return (x < 0 || y < 0 || x >= cols || y >= rows) ? 0 : d[y * cols + x]; }
    for (var r = 0; r < rows; r++) for (var c = 0; c < cols; c++) {
      var i = r * cols + c;
      if (d[i] === 0) continue;
      d[i] = Math.min(d[i], at(c - 1, r) + 1, at(c, r - 1) + 1, at(c - 1, r - 1) + D, at(c + 1, r - 1) + D);
    }
    for (r = rows - 1; r >= 0; r--) for (c = cols - 1; c >= 0; c--) {
      i = r * cols + c;
      if (d[i] === 0) continue;
      d[i] = Math.min(d[i], at(c + 1, r) + 1, at(c, r + 1) + 1, at(c + 1, r + 1) + D, at(c - 1, r + 1) + D);
    }
    return { cell: cell, cols: cols, rows: rows, d: d };
  }

  // Breadth-first search from the hole outwards over free cells until it meets
  // a source cell; returns the path from that source to the hole, or null.
  function grow(grid, target, isSource, maxLen) {
    var cols = grid.cols, rows = grid.rows, d = grid.d;
    var prev = new Int32Array(cols * rows).fill(-2);
    var queue = [target], depth = [0];
    prev[target] = -1;
    for (var q = 0; q < queue.length; q++) {
      var i = queue[q];
      if (isSource[i]) {
        var path = [];
        for (var j = i; j !== -1; j = prev[j]) path.push(j);
        return path;
      }
      if (depth[q] >= maxLen) continue;
      var c = i % cols, r = (i - c) / cols;
      var next = [c > 0 ? i - 1 : -1, c < cols - 1 ? i + 1 : -1, r > 0 ? i - cols : -1, r < rows - 1 ? i + cols : -1];
      for (var n = 0; n < 4; n++) {
        var m = next[n];
        if (m < 0 || prev[m] !== -2 || d[m] < 1) continue;
        prev[m] = i; queue.push(m); depth.push(depth[q] + 1);
      }
    }
    return null;
  }

  function round(v) { return Math.round(v * 10) / 10; }

  // Pure layout: region size, obstacle rectangles (region-local px), a seed and
  // the viewport width in; stems, leaves and blooms in region-local px out.
  function layout(input) {
    var s = settingsFor(input.viewportWidth);
    var grid = buildGrid(input.width, input.height, input.obstacles || [], LIMITS.pad);
    var cols = grid.cols, rows = grid.rows, d = grid.d, cell = grid.cell;
    var rand = rng(input.seed >>> 0);
    var out = { cell: cell, cols: cols, rows: rows, stems: [], leaves: [], blooms: [], nodes: 0 };

    var cands = [];
    for (var i = 0; i < d.length; i++) if (d[i] >= s.minR) cands.push({ i: i, score: d[i] + rand() * 0.75 });
    cands.sort(function (a, b) { return b.score - a.score || a.i - b.i; });
    cands.length = Math.min(cands.length, 600);

    var isSource = new Uint8Array(cols * rows), hasStem = false;
    var edge = new Uint8Array(cols * rows);
    for (var r = 0; r < rows; r++) {
      if (d[r * cols] >= 1) edge[r * cols] = 1;
      if (d[r * cols + cols - 1] >= 1) edge[r * cols + cols - 1] = 1;
    }
    var chosen = [];
    function center(idx) { var c = idx % cols; return { x: (c + 0.5) * cell, y: ((idx - c) / cols + 0.5) * cell, c: c, r: (idx - c) / cols }; }

    for (var k = 0; k < cands.length && out.blooms.length < s.maxBlooms; k++) {
      var t = cands[k].i, tc = center(t), far = true;
      for (var z = 0; z < chosen.length; z++) {
        if (Math.hypot(chosen[z].c - tc.c, chosen[z].r - tc.r) < s.spacing) { far = false; break; }
      }
      if (!far) continue;
      // Prefer joining a branch already drawn; otherwise start from the edge.
      var path = hasStem ? grow(grid, t, isSource, 28) : null;
      if (!path) {
        var both = new Uint8Array(cols * rows);
        for (i = 0; i < both.length; i++) both[i] = edge[i] | isSource[i];
        path = grow(grid, t, both, 40);
      }
      if (!path || path.length < 3) continue;
      var leafSlots = Math.floor((path.length - 2) / s.leafEvery);
      if (out.nodes + 3 + leafSlots > LIMITS.maxNodes) break;

      chosen.push(tc);
      var phase = rand() * 6.283, pts = [];
      for (var p = 0; p < path.length; p++) {
        var pc = center(path[p]);
        var a = path[Math.max(0, p - 1)], b = path[Math.min(path.length - 1, p + 1)];
        var horiz = Math.abs(a - b) < cols; // tangent runs along a row
        var wob = d[path[p]] >= 2 && p > 0 && p < path.length - 1 ? 0.18 * cell * Math.sin(p * 0.9 + phase) : 0;
        pts.push({ x: round(pc.x + (horiz ? 0 : wob)), y: round(pc.y + (horiz ? wob : 0)) });
        isSource[path[p]] = 1;
      }
      hasStem = true;
      out.stems.push(pts); out.nodes += 1;

      var side = rand() < 0.5 ? 1 : -1;
      for (p = 2; p < path.length - 2; p += s.leafEvery) {
        var dv = d[path[p]];
        if (dv < 2) continue;
        var q0 = pts[p - 1], q1 = pts[p + 1];
        var ang = Math.atan2(q1.y - q0.y, q1.x - q0.x) + side * (0.75 + rand() * 0.35);
        var len = Math.min(cell * 1.15, (dv - 1) * cell * 0.8);
        out.leaves.push({ x: pts[p].x, y: pts[p].y, tx: round(pts[p].x + Math.cos(ang) * len), ty: round(pts[p].y + Math.sin(ang) * len), w: round(len * 0.32) });
        out.nodes += 1; side = -side;
      }
      var br = Math.min(26, (d[t] - 1) * cell * 0.7);
      out.blooms.push({ x: round(tc.x), y: round(tc.y), r: round(br), petals: 5 + Math.floor(rand() * 2), rot: round(rand() * 6.283) });
      out.nodes += 2;
    }
    return out;
  }

  function f(v) { return String(round(v)); }

  // SVG element descriptions for a layout; also pure, so it is testable.
  function shapes(lay) {
    var list = [];
    lay.stems.forEach(function (pts) {
      var s = 'M' + f(pts[0].x) + ' ' + f(pts[0].y);
      for (var i = 1; i < pts.length - 1; i++) {
        s += 'Q' + f(pts[i].x) + ' ' + f(pts[i].y) + ' ' + f((pts[i].x + pts[i + 1].x) / 2) + ' ' + f((pts[i].y + pts[i + 1].y) / 2);
      }
      s += 'L' + f(pts[pts.length - 1].x) + ' ' + f(pts[pts.length - 1].y);
      list.push({ tag: 'path', attrs: { d: s, fill: 'none', stroke: 'currentColor', 'stroke-width': '1.25', 'stroke-linecap': 'round' } });
    });
    lay.leaves.forEach(function (l) {
      var mx = (l.x + l.tx) / 2, my = (l.y + l.ty) / 2, dx = l.tx - l.x, dy = l.ty - l.y, n = Math.hypot(dx, dy) || 1;
      var ox = -dy / n * l.w, oy = dx / n * l.w;
      list.push({ tag: 'path', attrs: { d: 'M' + f(l.x) + ' ' + f(l.y) + 'Q' + f(mx + ox) + ' ' + f(my + oy) + ' ' + f(l.tx) + ' ' + f(l.ty) + 'Q' + f(mx - ox) + ' ' + f(my - oy) + ' ' + f(l.x) + ' ' + f(l.y) + 'Z', fill: 'currentColor' } });
    });
    lay.blooms.forEach(function (b) {
      var s = '';
      for (var k = 0; k < b.petals; k++) {
        var a = b.rot + k * 6.283 / b.petals, ux = Math.cos(a), uy = Math.sin(a), vx = -uy, vy = ux;
        var bx = b.x + ux * b.r * 0.2, by = b.y + uy * b.r * 0.2, tx = b.x + ux * b.r, ty = b.y + uy * b.r;
        var cx = b.x + ux * b.r * 0.62, cy = b.y + uy * b.r * 0.62, w = b.r * 0.3;
        s += 'M' + f(bx) + ' ' + f(by) + 'Q' + f(cx + vx * w) + ' ' + f(cy + vy * w) + ' ' + f(tx) + ' ' + f(ty) + 'Q' + f(cx - vx * w) + ' ' + f(cy - vy * w) + ' ' + f(bx) + ' ' + f(by) + 'Z';
      }
      list.push({ tag: 'path', attrs: { d: s, fill: 'none', stroke: 'currentColor', 'stroke-width': '1' } });
      list.push({ tag: 'circle', attrs: { cx: f(b.x), cy: f(b.y), r: f(Math.max(1.5, b.r * 0.16)), fill: 'currentColor' } });
    });
    return list;
  }

  var api = { hashString: hashString, rng: rng, settingsFor: settingsFor, buildGrid: buildGrid, layout: layout, shapes: shapes, LIMITS: LIMITS };
  root.CitadelOrnament = api;

  // ------------------------------------------------------------- browser
  var doc = root.document;
  if (!doc || !doc.createRange || !root.addEventListener) return;

  var REGION = '.page--story article.story, .page--handbook article.handbook';
  var TEXT = 'p,li,h1,h2,h3,h4,h5,h6,dt,dd,figcaption,caption,summary,label';
  var BOX = 'img,picture,video,canvas,iframe,svg,table,pre,figure,blockquote,nav,button,input,select,textarea,hr,form,aside,details,.story__head,.handbook__head,.facts__row,.history li,.handbook__section--exercise,.handbook__closing,[class*="card"],[class*="banner"],[class*="contents"]';
  var NS = 'http://www.w3.org/2000/svg';
  var current = null;

  function measure(regionEl) {
    var vw = doc.documentElement.clientWidth, sy = root.scrollY || 0;
    var rr = regionEl.getBoundingClientRect();
    var top = rr.top + sy, height = rr.height, obstacles = [], rectLimitReached = false;
    var scope = doc.querySelector('main') || regionEl;
    function add(rect) {
      if (rect.width < 1 || rect.height < 1) return;
      var y = rect.top + sy - top;
      if (y > height || y + rect.height < 0) return;
      if (obstacles.length >= LIMITS.maxRects) { rectLimitReached = true; return; }
      obstacles.push({ x: rect.left, y: y, w: rect.width, h: rect.height });
    }
    var range = doc.createRange();
    var texts = scope.querySelectorAll(TEXT), boxes = scope.querySelectorAll(BOX), seen = 0;
    for (var i = 0; i < texts.length && seen < LIMITS.maxElements; i++, seen++) {
      range.selectNodeContents(texts[i]);
      var rects = range.getClientRects();
      for (var j = 0; j < rects.length; j++) add(rects[j]);
    }
    for (i = 0; i < boxes.length && seen < LIMITS.maxElements; i++, seen++) add(boxes[i].getBoundingClientRect());
    return { vw: vw, top: top, height: height, obstacles: obstacles, truncated: seen >= LIMITS.maxElements || rectLimitReached };
  }

  function render() {
    var regionEl = doc.querySelector(REGION);
    if (current) { current.remove(); current = null; }
    if (!regionEl) return;
    var m = measure(regionEl);
    if (m.truncated || m.height < 1) return; // too much to measure: draw nothing rather than guess
    var lay = layout({ width: m.vw, height: m.height, obstacles: m.obstacles, seed: hashString(root.location.pathname), viewportWidth: m.vw });
    if (!lay.blooms.length) return;
    var left = 0, top = m.top, body = doc.body;
    if (root.getComputedStyle(body).position !== 'static') {
      var br = body.getBoundingClientRect();
      left = -br.left; top -= br.top + (root.scrollY || 0);
    }
    var svg = doc.createElementNS(NS, 'svg');
    svg.setAttribute('class', 'ornament');
    svg.setAttribute('aria-hidden', 'true');
    svg.setAttribute('focusable', 'false');
    svg.setAttribute('width', String(m.vw));
    svg.setAttribute('height', String(Math.round(m.height)));
    svg.setAttribute('viewBox', '0 0 ' + m.vw + ' ' + Math.round(m.height));
    svg.style.left = left + 'px';
    svg.style.top = top + 'px';
    shapes(lay).forEach(function (sh) {
      var el = doc.createElementNS(NS, sh.tag);
      for (var k in sh.attrs) el.setAttribute(k, sh.attrs[k]);
      svg.appendChild(el);
    });
    body.appendChild(svg);
    current = svg;
  }

  var timer = 0;
  function schedule() { clearTimeout(timer); timer = setTimeout(render, 200); }

  if (!doc.querySelector(REGION)) return;
  root.addEventListener('resize', schedule, { passive: true });
  root.addEventListener('load', schedule);
  if (doc.fonts && doc.fonts.ready) doc.fonts.ready.then(schedule);
  var imgs = doc.querySelectorAll('main img');
  for (var n = 0; n < imgs.length && n < 40; n++) if (!imgs[n].complete) imgs[n].addEventListener('load', schedule, { once: true });
  schedule();
})(typeof window !== 'undefined' ? window : this);
