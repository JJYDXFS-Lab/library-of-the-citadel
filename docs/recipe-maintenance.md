# Recipe maintenance

Use the existing record schema and EN/ZH overlays. A content review is not a
kitchen test, professional safety review, rights clearance or publication approval.

## Revision checklist

- Identify the cut and form: shoulder chops / forequarter chops are 羊肩排,
  not a rack (羊肋排), whole shoulder or rolled roast. Keep bone-in, rolled,
  fresh/thawed and ready-to-eat qualifications explicit. Weight alone does not
  determine cooking time; preserve stated thickness, piece size and batch layout.
- Keep equipment and method together: oven mode, pan, cover, potato layer,
  added liquid, rack and basket space can change the result. Missing source
  dimensions stay unknown. Do not transfer a covered potato bake's time to
  meat-only roasting or infer a schedule from a 500 g pack.
- Preserve each stated oven mode. Do not silently convert an unlabelled final
  temperature to fan. The lamb-potato bake's final 200°C has no source mode;
  its explicit conventional-only path is an editorial choice, not a source claim.
- Keep source facts, editorial adaptations and safety guidance distinct. Show
  stage arithmetic where it conflicts with a source total. Keep cooking times
  as starting points, measured safety endpoints separate from texture, and
  recovery actions in the numbered method rather than collapsed UI.
- Put servings, timing and equipment in existing `summary` / `yield_note`
  prose. Label estimated prep, arithmetic totals, preheating exclusions and
  added batches; do not infer structured metadata with regular expressions.
- Keep first `sources[].accessed_at` dates unchanged. On an actual content
  change, update `reviewed_at` and `record_version`, prepend the newest history
  entry with `supersedes`, and add its Chinese translation. Leave historical
  entries untouched, including the original seven-note batch description.
- Empty-source practical notes remain `practical-note` with
  `none-authored-here`, `publication_ready: false` and unreviewed safety/rights.
  Removing an unsupported numerical claim is conservative editing, not
  promotion. Do not add a source just to evade that class's gate.
- Check allergies against the actual ingredients, packets and cross-contact;
  no herb or remainder of an ingredient list is categorically allergen-free.
  Follow appliance manuals for loading, cooling, unplugging and cleaning.

## Measuring spoons

The original practical notes now explicitly use an **editorial** tablespoon of
20 mL and teaspoon of 5 mL. This is not a claim about an outside publisher and
not a gram conversion. For sourced recipes retain the publisher's measure:
McCormick explicitly defines its oil tablespoon as 20 mL; where a source gives
no millilitre definition, the spoon volume is unknown. Do not silently impose
the practical-note convention, assume another country's spoon, or convert dry
ingredients to grams without evidence. Preserve this distinction in both languages.

## Jurisdiction-specific safety references

These references document the guidance used in the editorial evidence review;
they are not universal rules or a new citation inside a sourceless note. The
2026-11-07 revision included bounded primary-source checks, not a complete live
verification of every reference. Check the applicable local
authority and product instructions before using a threshold in a new context.

- [Health Canada — safe cooking temperatures](https://www.canada.ca/en/health-canada/services/general-food-safety-tips/safe-internal-cooking-temperatures.html):
  fish 70°C; poultry pieces 74°C (not a universal whole-bird value); ground
  beef/pork/lamb 71°C (not ground poultry); whole lamb cuts 63°C medium-rare,
  71°C medium and 77°C well done; reheated leftovers 74°C. Measure the relevant
  food's centre with a probe, away from bone and metal. Temperature does not
  establish that shoulder connective tissue has become tender.
- [FSANZ — 2-hour/4-hour rule](https://www.foodstandards.gov.au/business/food-safety/2-hour-4-hour-rule):
  for potentially hazardous food between 5°C and 60°C, count all relevant
  exposure cumulatively, including preparation, transport and display. Under
  2 hours: use or refrigerate; 2 to less than 4 hours: use immediately, do not
  refrigerate again; 4 hours or more: discard. Refrigeration does not reset the
  elapsed exposure. This is not a substitute for separate cooling or reheating
  requirements. A foil cover or insulated container alone does not validate
  hot holding or a cold chain.

Australian Lamb's eating-quality targets and 3–6°C carryover advice are kept
separate from safety thresholds; neither carryover nor colour proves a measured
endpoint. Whole-shoulder rest is 20 minutes before service or prompt chilling;
any longer wait requires controlled holding/storage, not an unconditional
couple of hours on the bench.

## Checkpoint and unresolved evidence

The focused refresh inspected all 28 records, corrected cooking guidance in
15 bilingual record pairs, and then refreshed contextual prose in all 28 pairs. The Coles rack recipe remains
pending live re-verification; retain its recorded weight rather than importing
a different shop product's weight. No complete source-faithfulness or personal
kitchen-testing claim follows from this review. Browser/mobile acceptance is
also distinct from generated-HTML checks.

Run `npm run check` and `npm run build`; retain semantic translation, numeric
parity, class, provenance and footer tests. Compare untouched files byte-for-byte
with the input, then record actual test/build counts and unresolved work in
`STATUS.md`. Do not overwrite prior milestones with the new result.
