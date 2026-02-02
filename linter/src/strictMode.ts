import AjvDefault from 'ajv';
import type { ValidateFunction, ErrorObject } from 'ajv';
import { traverseInstructions } from './instructionTraversal.js';
import BUILTIN_INSTRUCTIONS from '../instructions.json' with { type: 'json' };
import { SUPPLEMENTARY_SCHEMAS } from './instructionSchemas.js';

// Handle ESM/CJS interop - Ajv exports default as CommonJS
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const Ajv = (AjvDefault as any).default || AjvDefault;
// Initialize Ajv with allErrors for comprehensive validation
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const ajv = new Ajv({ allErrors: true, strict: false }) as any;

/**
 * Merge built-in instruction schemas with supplementary schemas.
 * Supplementary schemas take precedence if there's a conflict.
 */
const ALL_INSTRUCTION_SCHEMAS: Record<string, object> = {
  ...BUILTIN_INSTRUCTIONS,
  ...SUPPLEMENTARY_SCHEMAS,
};

/**
 * Pre-compiled validators for each instruction type.
 * Validators are compiled once at module load time for performance.
 */
const instructionValidators: Record<string, ValidateFunction> = {};

/**
 * Map of schema keys to instruction keys.
 * Handles cases where the schema key differs from the instruction key.
 * e.g., 'ratelimit' schema validates 'rateLimit' instruction
 */
const SCHEMA_TO_INSTRUCTION_KEY: Record<string, string> = {
  ratelimit: 'rateLimit',
};

/**
 * Adds additionalProperties: false to an object schema definition.
 * Handles oneOf/anyOf by adding to each variant.
 */
function addAdditionalPropertiesFalse(schemaDef: Record<string, unknown>): void {
  // Skip if already has additionalProperties defined
  if ('additionalProperties' in schemaDef) return;

  // Handle oneOf - add additionalProperties: false to each variant
  if (Array.isArray(schemaDef.oneOf)) {
    for (const variant of schemaDef.oneOf as Record<string, unknown>[]) {
      if (typeof variant === 'object' && !('additionalProperties' in variant)) {
        variant.additionalProperties = false;
      }
    }
    return;
  }

  // Handle anyOf - add additionalProperties: false to each variant
  if (Array.isArray(schemaDef.anyOf)) {
    for (const variant of schemaDef.anyOf as Record<string, unknown>[]) {
      if (typeof variant === 'object' && !('additionalProperties' in variant)) {
        variant.additionalProperties = false;
      }
    }
    return;
  }

  // Standard case - add directly to the schema definition
  schemaDef.additionalProperties = false;
}

/**
 * Enhances a schema by adding additionalProperties: false to the inner
 * instruction object to catch unknown properties in strict mode.
 * This compensates for schemas that don't have additionalProperties defined.
 */
function enhanceSchemaForStrictMode(
  instructionKey: string,
  schema: Record<string, unknown>
): Record<string, unknown> {
  // Deep clone the schema to avoid mutating the original
  const enhanced = JSON.parse(JSON.stringify(schema)) as Record<string, unknown>;

  // Find the instruction properties definition
  const properties = enhanced.properties as Record<string, unknown> | undefined;
  if (!properties) return enhanced;

  const instructionDef = properties[instructionKey] as Record<string, unknown> | undefined;
  if (!instructionDef || typeof instructionDef !== 'object') return enhanced;

  // Add additionalProperties: false (handles oneOf/anyOf variants)
  addAdditionalPropertiesFalse(instructionDef);

  return enhanced;
}

// Compile validators for all instructions
for (const [schemaKey, schema] of Object.entries(ALL_INSTRUCTION_SCHEMAS)) {
  // Skip 'conditions' - it has a different structure and will be handled specially
  if (schemaKey === 'conditions') continue;

  // Get the instruction key that this schema validates
  const instructionKey = SCHEMA_TO_INSTRUCTION_KEY[schemaKey] || schemaKey;

  try {
    // Enhance the schema to enforce strict property checking
    const enhancedSchema = enhanceSchemaForStrictMode(
      instructionKey,
      schema as Record<string, unknown>
    );
    instructionValidators[instructionKey] = ajv.compile(enhancedSchema);
  } catch (e) {
    // Log but don't fail - instruction will be skipped in validation
    console.warn(`Failed to compile schema for instruction '${instructionKey}':`, e);
  }
}

// Handle 'conditions' specially - its schema validates the conditions object directly
// (not wrapped in { conditions: {...} })
if (BUILTIN_INSTRUCTIONS.conditions) {
  try {
    const conditionsSchema = BUILTIN_INSTRUCTIONS.conditions;
    instructionValidators['conditions'] = ajv.compile({
      type: 'object',
      required: ['conditions'],
      maxProperties: 1,
      properties: {
        conditions: conditionsSchema,
      },
    });
  } catch (e) {
    console.warn('Failed to compile conditions schema:', e);
  }
}


/**
 * Set of known instruction types for quick lookup
 */
const KNOWN_INSTRUCTIONS = new Set(Object.keys(instructionValidators));

/**
 * Validates instruction arguments in strict mode using JSON Schema validation.
 * Checks nested properties, types, required fields, and enum values.
 * Returns errors in AJV ErrorObject format for backward compatibility.
 */
export function validateStrictMode(automation: unknown): ErrorObject[] {
  const errors: ErrorObject[] = [];

  if (!automation || typeof automation !== 'object') {
    return errors;
  }

  traverseInstructions(automation as { do?: unknown[] }, (instruction, path) => {
    const keys = Object.keys(instruction);

    // Find the instruction type (first key that matches a known instruction)
    const instructionType = keys.find(key => KNOWN_INSTRUCTIONS.has(key));

    if (!instructionType) {
      // Unknown instruction type - could be an app instruction (e.g., "Collection.find")
      // App instructions are not validated by strict mode
      return;
    }

    // Get the validator for this instruction type
    const validator = instructionValidators[instructionType];
    if (!validator) {
      return;
    }

    // Build the instruction object to validate
    // For most instructions: { instructionType: instructionValue }
    const instructionObj = { [instructionType]: instruction[instructionType] };

    // Run validation
    const isValid = validator(instructionObj);

    if (!isValid && validator.errors) {
      // Transform Ajv errors to include the full traversal path
      for (const err of validator.errors) {
        errors.push({
          ...err,
          // Prepend the traversal path to the instance path
          instancePath: `${path}${err.instancePath}`,
        } as ErrorObject);
      }
    }
  });

  return errors;
}
