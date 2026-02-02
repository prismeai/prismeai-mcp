export { lintAutomation } from './src/lintAutomation.js';
export { validateExpressions } from './src/expressionValidation.js';
export {
  KNOWN_FUNCTIONS,
  isKnownFunction,
  JS_KEYWORDS,
  isJsKeyword,
} from './src/knownFunctions.js';
export {
  extractExpressions,
  validateDelimiters,
  extractFunctionCalls,
  extractIdentifiers,
  toJavaScript,
  traverseStringValues,
  hasExpressions,
} from './src/expressionParser.js';
export type {
  LintOptions,
  AutomationLintResult,
  ExpressionErrorType,
  ExpressionErrorParams,
} from './src/types.js';
export type {
  ExpressionToken,
  FunctionCall,
  Identifier,
  DelimiterCheckResult,
  StringValueVisitor,
} from './src/expressionParser.js';
