import type { ErrorObject } from 'ajv';
import type { LintOptions, AutomationLintResult } from './types.js';
import { validateAutomation } from './automationSchema.js';
import { validateStrictMode } from './strictMode.js';
import { validateExpressions } from './expressionValidation.js';
import { validateNamingConventions } from './namingConventions.js';
import { traverseInstructions } from './instructionTraversal.js';

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
    // Use local validateAutomation with minimal schema
    // @prisme.ai/validation schemas are outdated and too restrictive
    const valid = validateAutomation(automation);
    // Shallow clone errors to avoid mutating Ajv's internal state
    const errors: ErrorObject[] = validateAutomation.errors
      ? [...validateAutomation.errors]
      : [];

    if (!valid) {
      return { valid: false, errors };
    }

    // Validate instruction structure (always enabled)
    const instructionKeyErrors = validateInstructionKeys(automation);
    if (instructionKeyErrors.length > 0) {
      return { valid: false, errors: [...errors, ...instructionKeyErrors] };
    }

    // Strict mode validation
    if (options?.strict) {
      const strictErrors = validateStrictMode(automation);
      if (strictErrors.length > 0) {
        return { valid: false, errors: [...errors, ...strictErrors] };
      }
    }

    // Expression validation (default: enabled)
    if (options?.validateExpressions !== false) {
      const expressionErrors = validateExpressions(automation);
      if (expressionErrors.length > 0) {
        return { valid: false, errors: [...errors, ...expressionErrors] };
      }
    }

    // Naming convention validation (default: disabled)
    if (options?.validateNaming) {
      const namingErrors = validateNamingConventions(automation);
      if (namingErrors.length > 0) {
        return { valid: false, errors: [...errors, ...namingErrors] };
      }
    }

    return { valid: true, errors: [] };
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
    };
  }
}
