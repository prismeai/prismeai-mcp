import type { ErrorObject } from 'ajv';
import type { LintOptions, AutomationLintResult } from './types.js';
import { validateAutomation } from './automationSchema.js';
import { validateStrictMode } from './strictMode.js';
import { validateExpressions } from './expressionValidation.js';
import { validateNamingConventions } from './namingConventions.js';
import { traverseInstructions } from './instructionTraversal.js';

/**
 * Returns a warning when the automation has no `arguments` declared.
 * Always-on check (not gated behind any option).
 */
function checkMissingArguments(automation: unknown): ErrorObject[] {
  if (!automation || typeof automation !== 'object') return [];
  const auto = automation as Record<string, unknown>;
  if (!('arguments' in auto)) {
    return [
      {
        keyword: 'warning',
        instancePath: '/arguments',
        schemaPath: '#/warnings/missingArguments',
        params: {},
        message:
          'No arguments declared. If this automation receives input data as parameters (not read from user.*, session.*, or global.* contexts), declare them in "arguments" for documentation and validation.',
      } as ErrorObject,
    ];
  }
  return [];
}

function toNamingWarning(error: ErrorObject): ErrorObject {
  const path = error.instancePath || '(root)';
  return {
    ...error,
    keyword: 'naming',
    message: `${error.message} To fix this convention issue, update the automation definition${path === '(root)' ? '' : ` at ${path}`}.`,
  } as ErrorObject;
}

function escapeJsonPointerSegment(segment: string): string {
  return segment.replace(/~/g, '~0').replace(/\//g, '~1');
}

/**
 * Rejects argument schema shapes that look like runtime validation but are not
 * DSUL-safe. Required arguments must be enforced explicitly in automation steps.
 */
function validateDSULSafeArgumentValidation(automation: unknown): ErrorObject[] {
  if (!automation || typeof automation !== 'object') return [];

  const auto = automation as Record<string, unknown>;
  if (auto.validateArguments !== true) return [];

  const args = auto.arguments;
  if (!args || typeof args !== 'object' || Array.isArray(args)) return [];

  const errors: ErrorObject[] = [];

  for (const [argName, argSchema] of Object.entries(args as Record<string, unknown>)) {
    if (!argSchema || typeof argSchema !== 'object' || Array.isArray(argSchema)) {
      continue;
    }

    const schema = argSchema as Record<string, unknown>;
    if (schema.required === true) {
      errors.push({
        keyword: 'argumentValidation',
        instancePath: `/arguments/${escapeJsonPointerSegment(argName)}/required`,
        schemaPath: '#/argumentValidation/unsupportedRequiredFlag',
        params: { argument: argName },
        message: `Argument "${argName}" uses required: true, which is not DSUL-safe with validateArguments: true. Add explicit conditions in the automation body to validate required arguments.`,
      } as ErrorObject);
    }
  }

  return errors;
}

/**
 * Validates that each instruction object has exactly one top-level key.
 * Multiple keys indicate a YAML indentation error where arguments
 * (like `output`) ended up as siblings of the instruction instead of children.
 */
function validateInstructionKeys(automation: unknown): ErrorObject[] {
  if (!automation || typeof automation !== 'object') return [];
  const errors: ErrorObject[] = [];

  traverseInstructions(automation as { do?: unknown[] }, (instruction, path) => {
    const keys = Object.keys(instruction);
    if (keys.length > 1) {
      // Find which key is likely the instruction name (first key)
      const instructionKey = keys[0];
      const extraKeys = keys.slice(1);
      errors.push({
        keyword: 'maxProperties',
        instancePath: path,
        schemaPath: '#/maxProperties',
        params: { limit: 1 },
        message: `Instruction "${instructionKey}" has unexpected sibling keys: ${extraKeys.join(', ')}. These should be nested inside the instruction arguments (check YAML indentation).`,
      } as ErrorObject);
    }
  });

  return errors;
}

export function lintAutomation(
  automation: unknown,
  options?: LintOptions
): AutomationLintResult {
  try {
    // Collect warnings (always-on checks, independent of validation outcome)
    const warnings = checkMissingArguments(automation);

    // Use local validateAutomation with minimal schema
    // @prisme.ai/validation schemas are outdated and too restrictive
    const valid = validateAutomation(automation);
    // Shallow clone errors to avoid mutating Ajv's internal state
    const errors: ErrorObject[] = validateAutomation.errors
      ? [...validateAutomation.errors]
      : [];

    if (!valid) {
      return { valid: false, errors, warnings };
    }

    const argumentValidationErrors = validateDSULSafeArgumentValidation(automation);
    if (argumentValidationErrors.length > 0) {
      return { valid: false, errors: [...errors, ...argumentValidationErrors], warnings };
    }

    // Validate instruction structure (always enabled)
    const instructionKeyErrors = validateInstructionKeys(automation);
    if (instructionKeyErrors.length > 0) {
      return { valid: false, errors: [...errors, ...instructionKeyErrors], warnings };
    }

    // Strict mode validation
    if (options?.strict) {
      const strictErrors = validateStrictMode(automation);
      if (strictErrors.length > 0) {
        return { valid: false, errors: [...errors, ...strictErrors], warnings };
      }
    }

    // Expression validation (default: enabled)
    if (options?.validateExpressions !== false) {
      const expressionErrors = validateExpressions(automation);
      if (expressionErrors.length > 0) {
        return { valid: false, errors: [...errors, ...expressionErrors], warnings };
      }
    }

    // Naming convention validation (always enabled, warnings only)
    const hasMissingArgumentsWarning = warnings.some(
      (warning) => warning.schemaPath === '#/warnings/missingArguments'
    );
    const namingErrors = validateNamingConventions(automation).filter(
      (error) => !(hasMissingArgumentsWarning && error.params?.namingType === 'missingArguments')
    );
    if (namingErrors.length > 0) {
      warnings.push(...namingErrors.map(toNamingWarning));
    }

    return { valid: true, errors: [], warnings };
  } catch {
    // Never throw - return as invalid
    return {
      valid: false,
      errors: [
        {
          keyword: 'type',
          instancePath: '',
          schemaPath: '#/type',
          params: { type: 'object' },
          message: 'Invalid input: expected automation object',
        } as ErrorObject,
      ],
      warnings: [],
    };
  }
}
