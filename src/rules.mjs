// Cross-record content rules that JSON Schema cannot express.
//
// Two families live here. Referential rules keep the collection manifest, its
// editorial sections, and the item files consistent. Honesty rules keep each
// record class from drifting into looking like another: a fixture must not grow
// sources or a review, an original practical note must not acquire citations it
// never had, and neither may pass for sourced, reviewed, publication-ready
// knowledge. That drift is the single most likely way this repository could end
// up making a claim nobody checked.

const ISO_DATE = /^[0-9]{4}-[0-9]{2}-[0-9]{2}$/;

/** Words that would turn an empty provenance field into a fake-looking pointer. */
const FAKE_SOURCE_MARKERS = [
  'example.com', 'example.org', 'placeholder', 'lorem ipsum',
  'todo://', 'http://todo', 'https://todo', 'your-site-here',
];

function pushIf(errors, condition, message) {
  if (condition) errors.push(message);
}

export function checkCollection(collection, items) {
  const errors = [];
  const byId = new Map(items.map((i) => [i.item_id, i]));

  for (const id of collection.item_ids) {
    pushIf(errors, !byId.has(id), `collection ${collection.collection_id}: item_ids references "${id}", which has no record under content/items/`);
  }
  for (const item of items) {
    pushIf(errors, item.collection_id !== collection.collection_id,
      `item ${item.item_id}: collection_id "${item.collection_id}" does not match the manifest "${collection.collection_id}"`);
    pushIf(errors, !collection.item_ids.includes(item.item_id),
      `item ${item.item_id}: exists on disk but is not listed in the "${collection.collection_id}" manifest`);
  }

  const seen = new Set();
  for (const id of collection.item_ids) {
    pushIf(errors, seen.has(id), `collection ${collection.collection_id}: duplicate item_id "${id}"`);
    seen.add(id);
  }

  errors.push(...checkVersionHistory(collection, `collection ${collection.collection_id}`));
  pushIf(errors, collection.record_class === 'fixture' && collection.publication_ready,
    `collection ${collection.collection_id}: a fixture collection must not be marked publication_ready`);

  errors.push(...checkSections(collection));

  return errors;
}

/**
 * Sections are an editorial grouping inside one collection, not a second
 * membership list. A section may only name records the collection already
 * holds, and no record belongs to two sections — otherwise the gallery would
 * present the same card twice under two competing headings.
 */
function checkSections(collection) {
  const errors = [];
  const label = `collection ${collection.collection_id}`;
  const members = new Set(collection.item_ids);
  const seenSections = new Set();
  const claimed = new Map();

  for (const section of collection.sections ?? []) {
    pushIf(errors, seenSections.has(section.section_id), `${label}: duplicate section_id "${section.section_id}"`);
    seenSections.add(section.section_id);

    const seenHere = new Set();
    for (const id of section.item_ids) {
      pushIf(errors, !members.has(id),
        `${label}: section "${section.section_id}" lists "${id}", which is not a member of the collection`);
      pushIf(errors, seenHere.has(id), `${label}: section "${section.section_id}" lists "${id}" twice`);
      seenHere.add(id);
      pushIf(errors, claimed.has(id) && claimed.get(id) !== section.section_id,
        `${label}: "${id}" is claimed by both section "${claimed.get(id)}" and section "${section.section_id}"`);
      claimed.set(id, section.section_id);
    }
  }

  return errors;
}

export function checkItem(item) {
  const label = `item ${item.item_id}`;
  const errors = [];

  // Identity and internal consistency.
  const variantIds = item.variants.map((v) => v.variant_id);
  pushIf(errors, new Set(variantIds).size !== variantIds.length, `${label}: duplicate variant_id`);

  const steps = item.method.map((m) => m.step);
  pushIf(errors, steps.some((s, i) => s !== i + 1), `${label}: method steps must be numbered 1..n in order, got [${steps.join(', ')}]`);

  pushIf(errors, !ISO_DATE.test(item.reviewed_at), `${label}: reviewed_at is not an ISO date`);
  errors.push(...checkVersionHistory(item, label));

  // Honesty rules.
  if (item.record_class === 'fixture') {
    pushIf(errors, item.publication_ready, `${label}: a fixture must not be marked publication_ready`);
    pushIf(errors, item.sources.length > 0, `${label}: a fixture must not carry source pointers; it was authored, not retrieved`);
    pushIf(errors, item.source_state !== 'none-fixture-authored', `${label}: a fixture must use source_state "none-fixture-authored", got "${item.source_state}"`);
    pushIf(errors, item.region.label_basis !== 'fixture-illustrative', `${label}: a fixture must use region.label_basis "fixture-illustrative"`);
    pushIf(errors, item.safety.review_state === 'reviewed', `${label}: a fixture must not claim a completed safety review`);
    pushIf(errors, !/fixture/i.test(item.record_notice), `${label}: record_notice must name the record as a fixture, since it is the banner every view renders`);
  }

  if (item.record_class === 'sourced') {
    pushIf(errors, item.sources.length === 0, `${label}: a sourced record needs at least one identified source URL`);
    pushIf(errors, item.source_state.startsWith('none-'), `${label}: source_state "${item.source_state}" contradicts record_class "sourced"`);
    pushIf(errors, item.rights.license_review_state === 'fixture-original-text', `${label}: sourced text cannot claim fixture-original-text licensing`);
  }

  // An original practical note is neither of the other two, and its gate keeps
  // it from drifting into either. It may not borrow a fixture's "this is only a
  // demonstration" cover, and it may not grow citations for text nobody
  // sourced: a note that acquires real sources is promoted to "sourced", it is
  // not annotated after the fact.
  if (item.record_class === 'practical-note') {
    pushIf(errors, item.publication_ready, `${label}: a practical note must not be marked publication_ready; it has had no factual or food-safety review`);
    pushIf(errors, item.sources.length > 0, `${label}: a practical note carries no source pointers — it was written here, not retrieved; promote it to "sourced" instead of citing it after the fact`);
    pushIf(errors, item.source_state !== 'none-authored-here', `${label}: a practical note must use source_state "none-authored-here", got "${item.source_state}"`);
    pushIf(errors, item.region.label_basis !== 'editorial-facet', `${label}: a practical note has no source to attribute a region to, so region.label_basis must be "editorial-facet"`);
    pushIf(errors, item.safety.review_state !== 'not-reviewed', `${label}: a practical note must use safety.review_state "not-reviewed"; it is neither a demonstration fixture nor professionally reviewed`);
    pushIf(errors, item.rights.license_review_state === 'fixture-original-text', `${label}: a practical note is original text, but it is not fixture text and cannot claim fixture-original-text licensing`);
    pushIf(errors, !/practical note/i.test(item.record_notice), `${label}: record_notice must name the record as a practical note, since it is the banner every view renders`);

    // The record cites nobody. If it still names a temperature to cook to the
    // centre, it has to send the reader to the authority it cannot cite.
    const methodText = item.method.map((m) => m.instruction).join(' ');
    pushIf(errors,
      /\b(internal temperature|in the centre|at the centre|internally)\b/i.test(methodText)
        && /\d+\s*°C/.test(methodText)
        && !/food-safety authority/i.test(methodText),
      `${label}: a practical note that gives a cook-to-the-centre temperature must tell the reader to check it against their own food-safety authority, because the record cites none`);
  }

  // The two sourceless states are not interchangeable: each belongs to exactly
  // one record class, so neither can be borrowed to blur what a record is.
  pushIf(errors, item.source_state === 'none-fixture-authored' && item.record_class !== 'fixture',
    `${label}: source_state "none-fixture-authored" belongs to record_class "fixture", not "${item.record_class}"`);
  pushIf(errors, item.source_state === 'none-authored-here' && item.record_class !== 'practical-note',
    `${label}: source_state "none-authored-here" belongs to record_class "practical-note", not "${item.record_class}"`);

  // No invented provenance, anywhere in the record's free text.
  const freeText = [item.provenance_note, item.record_notice, item.summary].join(' ').toLowerCase();
  for (const marker of FAKE_SOURCE_MARKERS) {
    pushIf(errors, freeText.includes(marker), `${label}: free text contains placeholder-source marker "${marker}"`);
  }
  for (const source of item.sources) {
    for (const marker of FAKE_SOURCE_MARKERS) {
      pushIf(errors, source.url.toLowerCase().includes(marker), `${label}: source URL contains placeholder marker "${marker}"`);
    }
  }

  // Image rights: an unreviewed record cannot ship images.
  pushIf(errors, item.rights.images.length > 0 && item.rights.image_rights_review_state !== 'cleared',
    `${label}: images are present but image_rights_review_state is "${item.rights.image_rights_review_state}"`);
  pushIf(errors, item.rights.images.length === 0 && item.rights.image_rights_review_state === 'cleared',
    `${label}: image_rights_review_state "cleared" but no images are recorded`);

  return errors;
}

/** record_version must be the newest change_history entry, and history must chain. */
function checkVersionHistory(record, label) {
  const errors = [];
  const history = record.change_history;
  pushIf(errors, history[0].version !== record.record_version,
    `${label}: record_version "${record.record_version}" is not the first (newest) change_history entry "${history[0].version}"`);
  pushIf(errors, history[history.length - 1].supersedes !== null,
    `${label}: the oldest change_history entry must have supersedes: null`);

  for (let i = 0; i < history.length - 1; i += 1) {
    pushIf(errors, history[i].supersedes !== history[i + 1].version,
      `${label}: change_history entry "${history[i].version}" declares supersedes "${history[i].supersedes}" but follows "${history[i + 1].version}"`);
  }

  const versions = history.map((h) => h.version);
  pushIf(errors, new Set(versions).size !== versions.length, `${label}: duplicate version in change_history`);
  return errors;
}
