import type { ErrorObject } from 'ajv';
import * as acorn from 'acorn';
import type { ExpressionErrorType, ExpressionErrorParams } from './types.js';
import {
  traverseStringValues,
  hasExpressions,
  validateDelimiters,
  extractExpressions,
  extractFunctionCalls,
  extractIdentifiers,
  toJavaScript,
} from './expressionParser.js';
import { isKnownFunction, isJsKeyword } from './knownFunctions.js';

/**
 * Create an expression validation error in Ajv ErrorObject format.
 */
function createError(
  path: string,
  expressionType: ExpressionErrorType,
  message: string,
  value: string,
  functionName?: string
): ErrorObject {
  const params: ExpressionErrorParams = {
    expressionType,
    value,
  };
  if (functionName) {
    params.function = functionName;
  }

  return {
    keyword: 'expression',
    instancePath: path,
    schemaPath: `#/expression/${expressionType}`,
    params,
    message,
  } as ErrorObject;
}

/**
 * Validate delimiter balance in a string value.
 */
function checkDelimiters(
  value: string,
  path: string,
  errors: ErrorObject[]
): void {
  const result = validateDelimiters(value);

  if (result.unclosedVariables > 0) {
    errors.push(
      createError(
        path,
        'unclosedVariable',
        `Unclosed variable reference: missing }}`,
        value
      )
    );
  }

  if (result.unclosedExpressions > 0) {
    errors.push(
      createError(
        path,
        'unclosedExpression',
        `Unclosed expression block: missing %}`,
        value
      )
    );
  }
}

/**
 * Validate function calls in expression blocks.
 */
function checkFunctionCalls(
  exprContent: string,
  value: string,
  path: string,
  errors: ErrorObject[]
): void {
  const calls = extractFunctionCalls(exprContent);

  for (const call of calls) {
    if (!isKnownFunction(call.name)) {
      errors.push(
        createError(
          path,
          'unknownFunction',
          `Unknown function '${call.name}' - not a recognized Prisme.ai expression function`,
          value,
          call.name
        )
      );
    }
  }
}

/**
 * Detect raw variables missing {{}} in expression blocks.
 */
function checkRawVariables(
  exprContent: string,
  value: string,
  path: string,
  errors: ErrorObject[]
): void {
  const identifiers = extractIdentifiers(exprContent);
  const functionCalls = extractFunctionCalls(exprContent);
  const functionNames = new Set(functionCalls.map(f => f.name));

  for (const id of identifiers) {
    // Skip if it's a known function name (even if not followed by parenthesis in this context)
    if (isKnownFunction(id.name)) {
      continue;
    }

    // Skip if it's a JS keyword/built-in
    if (isJsKeyword(id.name)) {
      continue;
    }

    // Skip if it's being used as a function call elsewhere
    if (functionNames.has(id.name)) {
      continue;
    }

    // Skip if it looks like a number (shouldn't happen with regex but be safe)
    if (/^\d+$/.test(id.name)) {
      continue;
    }

    // Skip common property access patterns that are valid
    // e.g., obj.length, arr.filter - the 'length' and 'filter' after dots
    // This is a heuristic - we check if there's a dot before the identifier
    // Note: This is simplified; full implementation would need AST

    errors.push(
      createError(
        path,
        'missingBrackets',
        `Variable '${id.name}' should be wrapped in {{}} inside expression block`,
        value
      )
    );
  }
}

/**
 * Validate JavaScript syntax in expression blocks.
 */
function checkJsSyntax(
  exprContent: string,
  value: string,
  path: string,
  errors: ErrorObject[]
): void {
  const jsCode = toJavaScript(exprContent);

  try {
    // Try to parse as an expression
    acorn.parse(`(${jsCode})`, { ecmaVersion: 2020 });
  } catch (err) {
    const syntaxError = err as SyntaxError & { pos?: number };
    errors.push(
      createError(
        path,
        'invalidSyntax',
        `Invalid JavaScript syntax in expression: ${syntaxError.message}`,
        value
      )
    );
  }
}

/**
 * Validate a single string value for expression errors.
 */
function validateStringValue(
  value: string,
  path: string,
  errors: ErrorObject[]
): void {
  // Skip empty strings or strings without expressions
  if (!value || !hasExpressions(value)) {
    return;
  }

  // Check delimiter balance first
  checkDelimiters(value, path, errors);

  // If delimiters are unbalanced, skip further validation
  // (would produce confusing errors)
  const delimResult = validateDelimiters(value);
  if (!delimResult.valid) {
    return;
  }

  // Extract and validate expression blocks
  const tokens = extractExpressions(value);

  for (const token of tokens) {
    if (token.type === 'expression') {
      const exprContent = token.innerContent;

      // Check function calls
      checkFunctionCalls(exprContent, value, path, errors);

      // Check for raw variables
      checkRawVariables(exprContent, value, path, errors);

      // Check JS syntax
      checkJsSyntax(exprContent, value, path, errors);
    }
    // Variable tokens ({{...}}) don't need internal validation
    // Their syntax is already validated by delimiter check
  }
}

/**
 * Validate all expressions in an automation.
 *
 * Traverses all string values in the automation and checks for:
 * - Unclosed variable references {{
 * - Unclosed expression blocks {%
 * - Unknown function calls
 * - Raw variables missing {{}} in expression blocks
 * - Invalid JavaScript syntax
 *
 * @param automation - The automation object to validate
 * @returns Array of errors found (empty if valid)
 */
export function validateExpressions(automation: unknown): ErrorObject[] {
  const errors: ErrorObject[] = [];

  if (!automation || typeof automation !== 'object') {
    return errors;
  }

  traverseStringValues(automation, (value, path) => {
    validateStringValue(value, path, errors);
  });

  return errors;
}
