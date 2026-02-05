import type { ErrorObject } from 'ajv';

/**
 * Types of expression errors that can be detected
 */
export type ExpressionErrorType =
  | 'unclosedVariable'
  | 'unclosedExpression'
  | 'unknownFunction'
  | 'invalidSyntax'
  | 'missingBrackets';

/**
 * Parameters for expression validation errors
 */
export type ExpressionErrorParams = {
  expressionType: ExpressionErrorType;
  value: string;
  function?: string; // For unknownFunction errors
};

export type LintOptions = {
  /**
   * Enable strict mode: validates that instruction arguments match their specs.
   * Unknown arguments (e.g., `foobar` on a `set` instruction) produce errors.
   * Default: false (not enforced yet in Studio/Runtime).
   */
  strict?: boolean;

  /**
   * Enable expression validation: validates expression syntax within string values.
   * Detects missing {{}} around variables, unclosed delimiters, unknown functions,
   * and invalid JavaScript syntax in {% %} blocks.
   * Default: true
   */
  validateExpressions?: boolean;

  /**
   * Enable naming convention validation: validates naming patterns for
   * automation names, slugs, descriptions, arguments, variables, and events.
   * Default: false
   */
  validateNaming?: boolean;
};

export type AutomationLintResult = {
  valid: boolean;
  errors: ErrorObject[];
};
