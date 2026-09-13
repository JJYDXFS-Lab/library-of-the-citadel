// Cross-record content rules that JSON Schema cannot express.
//
// Two families live here. Referential rules keep the collection manifest and the
// item files consistent. Honesty rules keep a fixture from drifting into looking
// like sourced, reviewed, publication-ready knowledge — that drift is the single
// most likely way this repository could end up making a claim nobody checked.

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
    pushIf(errors, item.source_state === 'none-fixture-authored', `${label}: source_state "none-fixture-authored" contradicts record_class "sourced"`);
    pushIf(errors, item.rights.license_review_state === 'fixture-original-text', `${label}: sourced text cannot claim fixture-original-text licensing`);
  }

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
