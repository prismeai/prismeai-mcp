/**
 * Whitelist of known Prisme.ai expression functions.
 * Functions not in this list will trigger an 'unknownFunction' error.
 *
 * Categories:
 * - Date: date manipulation and formatting
 * - UUID: unique identifier generation
 * - Math: mathematical operations
 * - String: string manipulation
 * - JSON: JSON parsing and stringification
 * - Object: object manipulation
 * - URL: URL handling
 * - Type checking: type validation helpers
 * - Pattern matching: regex and JSON matching
 */
export const KNOWN_FUNCTIONS = new Set([
  // Date
  'date',

  // UUID
  'uuid',

  // Math
  'rand',
  'round',
  'ceil',
  'floor',
  'abs',
  'min',
  'max',

  // String
  'lower',
  'upper',
  'truncate',
  'split',
  'join',
  'replace',
  'sanitize',
  'trim',
  'startsWith',
  'endsWith',
  'includes',
  'indexOf',
  'slice',
  'substring',
  'padStart',
  'padEnd',
  'repeat',
  'match',

  // JSON
  'json',
  'unsafejson',

  // Object
  'deepmerge',
  'keys',
  'values',
  'entries',
  'fromEntries',
  'assign',

  // URL
  'URLSearchParams',
  'URL',
  'encodeURIComponent',
  'decodeURIComponent',
  'encodeURI',
  'decodeURI',

  // Type checking
  'isArray',
  'isObject',
  'isString',
  'isNumber',
  'isBoolean',
  'isNull',
  'isUndefined',
  'typeof',

  // Pattern matching
  'regex',
  'jsonmatch',

  // Array
  'filter',
  'map',
  'reduce',
  'find',
  'findIndex',
  'some',
  'every',
  'flat',
  'flatMap',
  'sort',
  'reverse',
  'concat',
  'length',

  // Conversion
  'Number',
  'String',
  'Boolean',
  'parseInt',
  'parseFloat',

  // Object/Array utilities
  'Array',
  'Object',
  'JSON',
]);

/**
 * Check if a function name is in the known functions whitelist.
 * @param name - The function name to check
 * @returns true if the function is known, false otherwise
 */
export function isKnownFunction(name: string): boolean {
  return KNOWN_FUNCTIONS.has(name);
}

/**
 * JavaScript built-in identifiers that are valid in expressions
 * but are not function calls (used for raw variable detection).
 */
export const JS_KEYWORDS = new Set([
  // Literals
  'true',
  'false',
  'null',
  'undefined',
  'NaN',
  'Infinity',

  // Reserved words that might appear in expressions
  'this',
  'new',
  'typeof',
  'instanceof',
  'in',
  'of',
  'void',
  'delete',

  // Control flow (shouldn't appear but listed for safety)
  'if',
  'else',
  'return',
]);

/**
 * Check if an identifier is a JavaScript keyword or built-in.
 * @param name - The identifier to check
 * @returns true if it's a JS keyword/built-in, false otherwise
 */
export function isJsKeyword(name: string): boolean {
  return JS_KEYWORDS.has(name);
}
