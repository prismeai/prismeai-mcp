import type { ErrorObject } from 'ajv';
import type { LintOptions, AutomationLintResult } from './types.js';
import { validateAutomation } from './automationSchema.js';
import { validateStrictMode } from './strictMode.js';
import { validateExpressions } from './expressionValidation.js';
import { validateNamingConventions } from './namingConventions.js';

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
