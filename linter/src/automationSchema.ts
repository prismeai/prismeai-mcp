import AjvDefault from 'ajv';
import type { ValidateFunction } from 'ajv';

// Handle ESM/CJS interop - Ajv exports default as CommonJS
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const Ajv = (AjvDefault as any).default || AjvDefault;
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const ajv = new Ajv({ allErrors: true, strict: false }) as any;

/**
 * Minimal schema for validating DSUL automations.
 * This is intentionally permissive to avoid false positives from strict schemas.
 * Strict mode validation handles detailed instruction validation.
 */
const automationSchema = {
  type: 'object',
  required: ['name', 'do'],
  properties: {
    name: {
      oneOf: [
        { type: 'string' },
        { type: 'object', additionalProperties: { type: 'string' } }
      ]
    },
    slug: { type: 'string' },
    description: {
      oneOf: [
        { type: 'string' },
        { type: 'object', additionalProperties: { type: 'string' } }
      ]
    },
    do: {
      type: 'array',
      items: { type: 'object', minProperties: 1 }
    },
    when: { type: 'object' },
    arguments: { type: 'object' },
    output: {},
    private: { type: 'boolean' },
    disabled: { type: 'boolean' },
    validateArguments: { type: 'boolean' },
  },
  additionalProperties: true
};

/**
 * Compiled validator for DSUL automations.
 * Uses a minimal schema that validates basic structure without being too strict.
 */
export const validateAutomation: ValidateFunction = ajv.compile(automationSchema);
