// The margin ornament's pure layout: deterministic, clear of every measured
// obstacle, bounded in work, and responsive to the whitespace actually there.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';

const source = readFileSync(new URL('../src/assets/ornament.js', import.meta.url), 'utf8');
const sandbox = {};
vm.runInNewContext(source, sandbox);
const O = sandbox.CitadelOrnament;

// A text column of lines with ragged right ends, a heading, and an image.
function page(width, colLeft, colRight, height, lineGap = 30) {
  const obstacles = [];
  let y = 40;
  obstacles.push({ x: colLeft, y, w: (colRight - colLeft) * 0.6, h: 34 });
  y += 70;
  for (let i = 0; y < height - 60; i++, y += lineGap) {
    if (i % 9 === 8) { y += 20; continue; }
    const ragged = i % 9 === 7 ? 0.35 : 0.9 + ((i * 37) % 10) / 100;
    obstacles.push({ x: colLeft, y, w: Math.min(colRight - colLeft, (colRight - colLeft) * ragged), h: 22 });
  }
  obstacles.push({ x: colLeft, y: height / 2, w: (colRight - colLeft) * 0.5, h: 120 });
  return { width, height, obstacles, viewportWidth: width };
}

function rectDist(p, o) {
  const dx = Math.max(o.x - p.x, 0, p.x - (o.x + o.w));
  const dy = Math.max(o.y - p.y, 0, p.y - (o.y + o.h));
  return Math.hypot(dx, dy);
}
function minDist(p, obstacles) { return Math.min(...obstacles.map((o) => rectDist(p, o))); }

function assertClear(lay, obstacles) {
  for (const stem of lay.stems) {
    for (let i = 0; i < stem.length; i++) {
      assert.ok(minDist(stem[i], obstacles) >= 8, `stem point ${JSON.stringify(stem[i])} too close`);
      if (i) {
        const mid = { x: (stem[i].x + stem[i - 1].x) / 2, y: (stem[i].y + stem[i - 1].y) / 2 };
        assert.ok(minDist(mid, obstacles) >= 8, 'stem segment too close');
      }
    }
  }
  for (const l of lay.leaves) {
    assert.ok(minDist({ x: l.tx, y: l.ty }, obstacles) >= 4, 'leaf tip touches an obstacle');
  }
  for (const b of lay.blooms) {
    assert.ok(minDist(b, obstacles) >= b.r + 4, 'bloom overlaps an obstacle');
  }
}

test('same geometry and seed give the same layout; another seed varies it', () => {
  const input = { ...page(1440, 270, 1170, 2400), seed: O.hashString('/stories/a/') };
  const a = JSON.stringify(O.layout(input));
  const b = JSON.stringify(O.layout({ ...input, obstacles: input.obstacles.map((o) => ({ ...o })) }));
  assert.equal(a, b);
  const c = JSON.stringify(O.layout({ ...input, seed: O.hashString('/stories/b/') }));
  assert.notEqual(a, c);
});

test('wide page grows connected branches into the margins, clear of text', () => {
  const input = { ...page(1440, 270, 1170, 2400), seed: 7 };
  const lay = O.layout(input);
  assert.ok(lay.blooms.length >= 2, `expected margin blooms, got ${lay.blooms.length}`);
  assert.ok(lay.blooms.length <= O.settingsFor(1440).maxBlooms);
  assert.equal(lay.stems.length, lay.blooms.length);
  for (const b of lay.blooms) assert.ok(b.x < 270 || b.x > 1170, `bloom at ${b.x} is not in a margin`);
  // Every stem starts at the region edge or on an earlier stem.
  const seen = new Set();
  for (const stem of lay.stems) {
    const s = stem[0];
    const onEdge = s.x < lay.cell || s.x > input.width - lay.cell;
    const onStem = [...seen].some((k) => { const [x, y] = k.split(',').map(Number); return Math.hypot(x - s.x, y - s.y) <= lay.cell * 0.5; });
    assert.ok(onEdge || onStem, 'branch is not rooted');
    for (const p of stem) seen.add(`${p.x},${p.y}`);
  }
  assertClear(lay, input.obstacles);
  assert.equal(O.shapes(lay).length, lay.nodes);
});

test('narrow, full-width text leaves nothing safe to decorate', () => {
  const input = { ...page(390, 16, 374, 2400, 28), seed: 7 };
  const lay = O.layout(input);
  assert.equal(lay.blooms.length, 0);
  assert.equal(lay.stems.length, 0);
});

test('a mid-width page decorates only real holes, at lower density', () => {
  // 860px with a short verse stanza leaving a hole at the right.
  const input = { ...page(860, 24, 836, 1600), seed: 11 };
  input.obstacles = input.obstacles.filter((o) => !(o.y > 600 && o.y < 1000));
  for (let y = 610; y < 990; y += 30) input.obstacles.push({ x: 24, y, w: 300, h: 22 });
  const lay = O.layout(input);
  assert.ok(lay.blooms.length >= 1 && lay.blooms.length <= O.settingsFor(860).maxBlooms);
  for (const b of lay.blooms) assert.ok(b.y > 560 && b.y < 1040 && b.x > 330, 'bloom outside the verse hole');
  assertClear(lay, input.obstacles);
});

test('work stays bounded on a very tall page', () => {
  const input = { ...page(1920, 510, 1410, 40000), seed: 3 };
  const lay = O.layout(input);
  assert.ok(lay.cols * lay.rows <= O.LIMITS.maxCells);
  assert.ok(lay.nodes <= O.LIMITS.maxNodes);
  assert.ok(lay.blooms.length <= O.settingsFor(1920).maxBlooms);
  assertClear(lay, input.obstacles);
});
