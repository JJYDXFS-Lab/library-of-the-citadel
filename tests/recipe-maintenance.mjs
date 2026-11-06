import test, { after } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, rmSync } from 'node:fs';
import path from 'node:path';
import { repoRoot } from '../src/config.mjs';
import { loadContent } from '../src/content.mjs';
import { loadOverlay, localizeItem } from '../src/i18n.mjs';
import { build } from '../src/build.mjs';
import { esc } from '../src/templates/pages.mjs';

const { items } = loadContent();
const item = (slug) => items.find((record) => record.item_id === `wr-${slug}`);
const method = (record) => record.method.map((entry) => entry.instruction).join(' ');
const liveText = (record) => JSON.stringify({ ...record, change_history: [] });
const revised = items.filter((record) => record.reviewed_at === '2026-11-07');
const outDir = path.join(repoRoot, 'dist-test-recipe-maintenance');
after(() => rmSync(outDir, { recursive: true, force: true }));

test('the focused refresh versions only fifteen records and preserves their honesty gates', () => {
  assert.equal(items.length, 28);
  assert.equal(revised.length, 15);
  for (const record of revised) {
    assert.equal(record.record_version, '1.0.1');
    assert.equal(record.change_history.length, 2);
    assert.equal(record.change_history[0].date, record.reviewed_at);
    assert.equal(record.change_history[0].supersedes, '1.0.0');
    assert.equal(record.change_history[1].version, '1.0.0');
    assert.equal(record.change_history[1].supersedes, null);
    assert.equal(record.publication_ready, false);
    assert.equal(record.safety.review_state, 'not-reviewed');
    assert.equal(record.rights.license_review_state, 'not-reviewed');
    for (const source of record.sources) {
      assert.ok(source.accessed_at < record.reviewed_at);
    }
  }
});

test('the lamb potato method exposes the mode ambiguity and retains its covered-potato boundary', () => {
  const record = item('oven-lamb-potato-bake');
  assert.match(record.method[0].instruction, /200°C conventional throughout, an editorial choice/);
  assert.match(record.method[4].instruction, /baking paper.*foil.*45 minutes/);
  assert.match(record.method[5].instruction, /15 minutes/);
  assert.match(record.method[5].instruction, /NO oven mode/);
  assert.match(record.method[5].instruction, /does not establish 200°C fan-forced/);
  assert.match(record.method[6].instruction, /63°C does not establish tenderness/);
  assert.match(record.provenance_note, /no chop weight or thickness.*no potato-slice thickness.*no added liquid/);
  assert.match(record.provenance_note, /meat-only cooking.*500 g/);
  assert.equal(record.ingredients[2].item, 'Pontiac potatoes, thinly sliced');
  const { record: chinese } = localizeItem(record, loadOverlay('items', 'zh', record.item_id), 'zh');
  assert.match(chinese.ingredients[0].item, /羊肩排（forequarter chops）/);
  assert.match(chinese.method[5].instruction, /变嫩/);
  assert.doesNotMatch(liveText(chinese), /前腿|排骨|软烂|唯一来源/);
});

test('confirmed lamb guidance stays intact while the rack explicitly awaits live verification', () => {
  const rack = item('oven-cumin-lamb-rack-roast');
  const mini = item('oven-rosemary-garlic-lamb-mini-roast');
  assert.match(method(rack), /60°C for rare, 60 to 65°C for medium rare and 65 to 70°C for medium/);
  for (const record of [rack, mini]) {
    assert.match(method(record), /3 to 6°C/);
    assert.doesNotMatch(record.summary, /quickest/);
  }
  assert.match(rack.provenance_note, /Live verification pending/);
  assert.match(rack.yield_note, /two 500 g racks/);
  assert.match(mini.ingredients.map((row) => row.item).join(' '), /leg mini roast/i);
  assert.match(mini.summary, /under-hour finish is not guaranteed/);
});

test('whole shoulder has a covered recovery and conditional prolonged holding', () => {
  const record = item('oven-slow-roast-lamb-shoulder');
  assert.match(record.method[5].instruction, /two forks.*cover again.*180°C conventional or 160°C fan-forced until tender/);
  assert.match(record.method[6].instruction, /20 minutes.*serve, or promptly portion and chill/);
  assert.match(record.method[6].instruction, /controlled hot holding or prompt chilling/);
  assert.doesNotMatch(record.summary, /gives leftovers/);
});

test('potato thickness, mince measurement and staged time discrepancies are explicit', () => {
  const fish = item('oven-puttanesca-fish-traybake');
  assert.match(fish.ingredients[0].note, /no more than 1.75 cm/);
  assert.match(fish.method[1].instruction, /no more than 1.75 cm/);
  const ziti = item('oven-baked-ziti');
  assert.match(ziti.method[3].instruction, /probe thermometer.*71°C.*absence of pink or red is not proof/);
  assert.match(ziti.yield_note, /25 covered \+ 10 uncovered.*35 minutes/);
  assert.match(ziti.yield_note, /internally inconsistent/);
  const halloumi = item('oven-halloumi-chickpea-traybake');
  assert.match(halloumi.yield_note, /40 to 45 minutes cooking.*45 to 50 minutes/);
  assert.match(method(item('oven-chicken-thigh-traybake')), /74°C/);
  assert.match(method(item('oven-portuguese-chicken-potato-bake')), /74°C/);
});

test('original notes retain their class while removing unverified salmon thresholds and visual fallbacks', () => {
  const notes = items.filter((record) => record.record_class === 'practical-note');
  assert.equal(notes.length, 8);
  for (const record of notes) {
    assert.deepEqual(record.sources, []);
    assert.equal(record.source_state, 'none-authored-here');
    assert.match(record.yield_note, /Editorial measuring convention.*tablespoon 20 mL; teaspoon 5 mL/);
  }
  const sharing = item('airfryer-garlic-lemon-salmon');
  assert.doesNotMatch(liveText(sharing), /63°C|60°C|5°C|Under 2 hours|Between 2 and 4 hours|Over 4 hours/);
  assert.match(sharing.method[4].instruction, /9 to 13 minutes.*probe thermometer.*local food-safety authority/);
  assert.match(sharing.method[6].instruction, /local authority.*temperature monitoring/);
  assert.doesNotMatch(liveText(sharing), /introduces no allergen|Nothing else written here introduces/);
  const chicken = item('airfryer-chicken-thigh-bites');
  assert.match(chicken.safety.caveats[1], /probe thermometer is required.*do not validate chicken by colour/);
  assert.doesNotMatch(liveText(chicken), /If you have no thermometer, cut/);
  assert.match(chicken.yield_note, /second batch adds a full 12 to 15 minutes/);
  assert.match(chicken.method[3].instruction, /75°C.*confirm.*food-safety authority/);
});

test('practical ingredient and appliance qualifications replace absolute assurances', () => {
  assert.equal(item('airfryer-bean-cheese-quesadilla').ingredients[1].quantity, '200 g drained');
  assert.match(method(item('airfryer-crispy-tofu')), /ready to eat only if its package explicitly permits/);
  assert.doesNotMatch(liveText(item('airfryer-crispy-tofu')), /hotter than an oven/);
  assert.match(method(item('airfryer-broccoli-mixed-veg')), /Frozen vegetable packets may require thorough cooking/);
  assert.match(liveText(item('airfryer-broccoli-mixed-veg')), /Oil coating does not guarantee against fan lift/);
  assert.doesNotMatch(liveText(item('airfryer-sweet-potato-wedges')), /longest in this section|only one that does not fit|No safety threshold applies/);
  for (const record of items.filter((entry) => entry.item_id.startsWith('wr-airfryer-') && !entry.item_id.endsWith('garlic-lemon-salmon'))) {
    assert.match(method(record), /unplug and let the appliance cool before cleaning/);
    assert.doesNotMatch(method(record), /Twelve fits most|Nothing sticks if|need no scrubbing|nothing more than hot water/);
  }
});

test('both locales put yield in the header once and retain every numbered, visible method step', () => {
  const result = build({ LIBRARY_OUT_DIR: 'dist-test-recipe-maintenance' });
  for (const language of ['en', 'zh']) {
    const prefix = language === 'en' ? '' : 'zh/';
    for (const original of items) {
      const record = language === 'en' ? original : localizeItem(original, loadOverlay('items', 'zh', original.item_id), 'zh').record;
      const html = readFileSync(path.join(result.outDir, prefix, 'recipes', record.item_id, 'index.html'), 'utf8');
      const header = html.match(/<header class="record__head">([\s\S]*?)<\/header>/)?.[1];
      assert.ok(header?.includes(esc(record.yield_note)), `${language}/${record.item_id}: missing header yield`);
      assert.equal(html.split('<p class="yield">').length - 1, 1);
      assert.ok(html.indexOf('<p class="yield">') < html.indexOf('id="h-ingredients"'));
      const steps = html.match(/<ol class="method">([\s\S]*?)<\/ol>/)?.[1];
      assert.equal((steps?.match(/<li>/g) ?? []).length, record.method.length);
      assert.doesNotMatch(steps, /<details/);
      for (const entry of record.method) assert.ok(steps.includes(esc(entry.instruction)));
    }
    const gallery = readFileSync(path.join(result.outDir, prefix, 'recipes/index.html'), 'utf8');
    assert.match(gallery, /data-haystack="[^"]*lamb shoulder chops[^"]*forequarter chops[^"]*羊肩排/);
  }
});
