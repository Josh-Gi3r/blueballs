/** Small JSON Schema 2020-12 subset used by Blueballs API contracts.
 * Deliberately dependency-free and shared by request/response validation.
 * Unknown keywords are ignored; every keyword we emit from the production
 * contract generators is explicitly handled here. */

function typeMatches(value, type) {
  if (type === "null") return value === null;
  if (type === "array") return Array.isArray(value);
  if (type === "object")
    return value !== null && typeof value === "object" && !Array.isArray(value);
  if (type === "integer") return Number.isInteger(value);
  if (type === "number") return typeof value === "number" && Number.isFinite(value);
  return typeof value === type;
}

function validateFormat(value, format) {
  if (format === "date-time") return Number.isFinite(Date.parse(value));
  if (format === "date")
    return /^\d{4}-\d{2}-\d{2}$/.test(value) &&
      Number.isFinite(Date.parse(`${value}T00:00:00Z`));
  if (format === "email") return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
  if (format === "uri") {
    try {
      new URL(value);
      return true;
    } catch {
      return false;
    }
  }
  if (format === "uri-reference")
    return typeof value === "string" && value.length > 0;
  return true;
}

function dereference(schema, registry) {
  if (!schema?.$ref) return schema;
  const prefix = "#/components/schemas/";
  if (!schema.$ref.startsWith(prefix))
    throw new Error(`Unsupported schema ref ${schema.$ref}`);
  const name = schema.$ref.slice(prefix.length);
  const resolved = registry[name];
  if (!resolved) throw new Error(`Unknown schema ${name}`);
  return resolved;
}

export function schemaErrors(value, inputSchema, registry, path = "$") {
  const schema = dereference(inputSchema, registry);
  if (!schema) return [`${path}: missing schema`];

  if (schema.anyOf) {
    const alternatives = schema.anyOf.map((candidate) =>
      schemaErrors(value, candidate, registry, path),
    );
    return alternatives.some((errors) => errors.length === 0)
      ? []
      : [`${path}: did not match any allowed schema`];
  }
  if (schema.oneOf) {
    const alternatives = schema.oneOf.map((candidate) =>
      schemaErrors(value, candidate, registry, path),
    );
    const matches = alternatives.filter((errors) => errors.length === 0).length;
    return matches === 1 ? [] : [`${path}: expected exactly one matching schema`];
  }
  if (schema.allOf) {
    return schema.allOf.flatMap((candidate) =>
      schemaErrors(value, candidate, registry, path),
    );
  }

  if (schema.const !== undefined && value !== schema.const) {
    return [
      `${path}: expected constant ${JSON.stringify(schema.const)}, got ${JSON.stringify(value)}`,
    ];
  }
  if (schema.enum && !schema.enum.includes(value)) {
    return [
      `${path}: expected one of ${schema.enum.map(String).join(", ")}, got ${JSON.stringify(value)}`,
    ];
  }

  const allowedTypes =
    schema.type === undefined
      ? null
      : Array.isArray(schema.type)
        ? schema.type
        : [schema.type];
  if (allowedTypes && !allowedTypes.some((type) => typeMatches(value, type))) {
    return [
      `${path}: expected ${allowedTypes.join("|")}, got ${
        value === null ? "null" : Array.isArray(value) ? "array" : typeof value
      }`,
    ];
  }

  if (value === null) return [];
  const errors = [];

  if (typeof value === "string") {
    if (schema.pattern && !new RegExp(schema.pattern).test(value))
      errors.push(`${path}: value does not match ${schema.pattern}`);
    if (schema.minLength !== undefined && value.length < schema.minLength)
      errors.push(`${path}: shorter than minLength ${schema.minLength}`);
    if (schema.maxLength !== undefined && value.length > schema.maxLength)
      errors.push(`${path}: longer than maxLength ${schema.maxLength}`);
    if (schema.format && !validateFormat(value, schema.format))
      errors.push(`${path}: invalid ${schema.format}`);
  }

  if (typeof value === "number") {
    if (schema.minimum !== undefined && value < schema.minimum)
      errors.push(`${path}: below minimum ${schema.minimum}`);
    if (schema.maximum !== undefined && value > schema.maximum)
      errors.push(`${path}: above maximum ${schema.maximum}`);
    if (
      schema.exclusiveMinimum !== undefined &&
      value <= schema.exclusiveMinimum
    )
      errors.push(`${path}: must be > ${schema.exclusiveMinimum}`);
    if (
      schema.exclusiveMaximum !== undefined &&
      value >= schema.exclusiveMaximum
    )
      errors.push(`${path}: must be < ${schema.exclusiveMaximum}`);
  }

  if (Array.isArray(value)) {
    if (schema.minItems !== undefined && value.length < schema.minItems)
      errors.push(`${path}: needs at least ${schema.minItems} item(s)`);
    if (schema.maxItems !== undefined && value.length > schema.maxItems)
      errors.push(`${path}: exceeds maxItems ${schema.maxItems}`);
    if (schema.uniqueItems && new Set(value.map((item) => JSON.stringify(item))).size !== value.length)
      errors.push(`${path}: array items must be unique`);
    if (schema.items) {
      value.forEach((item, index) =>
        errors.push(...schemaErrors(item, schema.items, registry, `${path}[${index}]`)),
      );
    }
  }

  if (value && typeof value === "object" && !Array.isArray(value)) {
    const properties = schema.properties ?? {};
    for (const required of schema.required ?? []) {
      if (!(required in value))
        errors.push(`${path}.${required}: required property missing`);
    }
    for (const [key, child] of Object.entries(value)) {
      if (properties[key]) {
        errors.push(...schemaErrors(child, properties[key], registry, `${path}.${key}`));
      } else if (schema.additionalProperties === false) {
        errors.push(`${path}.${key}: undocumented property`);
      } else if (
        schema.additionalProperties &&
        typeof schema.additionalProperties === "object"
      ) {
        errors.push(
          ...schemaErrors(
            child,
            schema.additionalProperties,
            registry,
            `${path}.${key}`,
          ),
        );
      }
    }
  }

  return errors;
}
