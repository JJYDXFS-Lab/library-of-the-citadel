// A deliberately small JSON Schema subset interpreter.
//
// The content schemas under content/schema/ are the single source of truth for
// record shape, and they are ordinary JSON Schema documents so the records stay
// portable to any other validator. This module implements only the keywords
// those schemas actually use. Anything outside that subset throws rather than
// being silently ignored — a schema constraint that quietly does nothing is
// worse than no constraint, because it reads like a guarantee.

const SUPPORTED = new Set([
  '$schema', '$id', '$comment', 'title', 'description',
  'type', 'const', 'enum', 'pattern', 'minLength',
  'required', 'properties', 'additionalProperties',
  'items', 'minItems',
]);

function typeOf(value) {
  if (value === null) return 'null';
  if (Array.isArray(value)) return 'array';
  if (Number.isInteger(value)) return 'integer';
  return typeof value;
}

function matchesType(value, expected) {
  const actual = typeOf(value);
  if (expected === 'number') return actual === 'number' || actual === 'integer';
  if (expected === 'integer') return actual === 'integer';
  return actual === expected;
}

function assertSupported(schema, where) {
  for (const key of Object.keys(schema)) {
    if (!SUPPORTED.has(key)) {
      throw new Error(`Unsupported JSON Schema keyword "${key}" at ${where}. Extend src/schema-validate.mjs or express the rule in src/rules.mjs.`);
    }
  }
}

/**
 * @returns {string[]} human-readable errors; empty means valid.
 */
export function validate(value, schema, pointer = '$') {
  assertSupported(schema, pointer);
  const errors = [];

  if (schema.type !== undefined) {
    const expected = Array.isArray(schema.type) ? schema.type : [schema.type];
    if (!expected.some((t) => matchesType(value, t))) {
      errors.push(`${pointer}: expected type ${expected.join(' or ')}, got ${typeOf(value)}`);
      return errors; // Later keywords assume the type held.
    }
  }

  if (schema.const !== undefined && value !== schema.const) {
    errors.push(`${pointer}: expected constant ${JSON.stringify(schema.const)}, got ${JSON.stringify(value)}`);
  }

  if (schema.enum !== undefined && !schema.enum.includes(value)) {
    errors.push(`${pointer}: ${JSON.stringify(value)} is not one of ${schema.enum.map((v) => JSON.stringify(v)).join(', ')}`);
  }

  if (typeof value === 'string') {
    if (schema.pattern !== undefined && !new RegExp(schema.pattern).test(value)) {
      errors.push(`${pointer}: ${JSON.stringify(value)} does not match /${schema.pattern}/`);
    }
    if (schema.minLength !== undefined && value.length < schema.minLength) {
      errors.push(`${pointer}: string length ${value.length} is below minLength ${schema.minLength}`);
    }
  }

  if (Array.isArray(value)) {
    if (schema.minItems !== undefined && value.length < schema.minItems) {
      errors.push(`${pointer}: array length ${value.length} is below minItems ${schema.minItems}`);
    }
    if (schema.items !== undefined) {
      value.forEach((entry, i) => errors.push(...validate(entry, schema.items, `${pointer}[${i}]`)));
    }
  }

  if (value !== null && typeof value === 'object' && !Array.isArray(value)) {
    for (const key of schema.required ?? []) {
      if (!Object.prototype.hasOwnProperty.call(value, key)) {
        errors.push(`${pointer}: missing required property "${key}"`);
      }
    }
    const properties = schema.properties ?? {};
    for (const [key, sub] of Object.entries(properties)) {
      if (Object.prototype.hasOwnProperty.call(value, key)) {
        errors.push(...validate(value[key], sub, `${pointer}.${key}`));
      }
    }
    if (schema.additionalProperties === false) {
      for (const key of Object.keys(value)) {
        if (!Object.prototype.hasOwnProperty.call(properties, key)) {
          errors.push(`${pointer}: unexpected property "${key}"`);
        }
      }
    } else if (schema.additionalProperties !== undefined && typeof schema.additionalProperties === 'object') {
      throw new Error(`Unsupported additionalProperties schema at ${pointer}`);
    }
  }

  return errors;
}
