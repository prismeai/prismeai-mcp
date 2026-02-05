/**
 * Represents a parsed expression block from a string value
 */
export type ExpressionToken = {
  type: 'variable' | 'expression';
  content: string;      // The full match including delimiters
  innerContent: string; // Content inside delimiters
  start: number;        // Start position in original string
  end: number;          // End position in original string
};

/**
 * Represents a function call found in an expression
 */
export type FunctionCall = {
  name: string;
  start: number;
  end: number;
};

/**
 * Represents a bare identifier (potential raw variable)
 */
export type Identifier = {
  name: string;
  start: number;
  end: number;
};

/**
 * Result of delimiter validation
 */
export type DelimiterCheckResult = {
  valid: boolean;
  unclosedVariables: number;  // Count of unclosed {{
  unclosedExpressions: number; // Count of unclosed {%
};

/**
 * Extract all expression tokens from a string value.
 * Finds both {{variable}} and {% expression %} blocks.
 * Note: {{}} inside {% %} blocks are NOT returned as separate tokens.
 *
 * @param value - The string value to parse
 * @returns Array of expression tokens found
 */
export function extractExpressions(value: string): ExpressionToken[] {
  const tokens: ExpressionToken[] = [];

  // First, find all {% %} expression blocks and their ranges
  const expressionRanges: Array<{ start: number; end: number }> = [];
  const expressionRegex = /\{%([^%]*(?:%(?!\})[^%]*)*)%\}/g;
  let match;

  while ((match = expressionRegex.exec(value)) !== null) {
    const start = match.index;
    const end = match.index + match[0].length;
    expressionRanges.push({ start, end });
    tokens.push({
      type: 'expression',
      content: match[0],
      innerContent: match[1],
      start,
      end,
    });
  }

  // Match {{...}} variable references that are NOT inside {% %} blocks
  const variableRegex = /\{\{([^}]*)\}\}/g;
  while ((match = variableRegex.exec(value)) !== null) {
    const start = match.index;
    const end = match.index + match[0].length;

    // Check if this variable is inside an expression block
    const isInsideExpression = expressionRanges.some(
      range => start >= range.start && end <= range.end
    );

    if (!isInsideExpression) {
      tokens.push({
        type: 'variable',
        content: match[0],
        innerContent: match[1],
        start,
        end,
      });
    }
  }

  // Sort by position
  tokens.sort((a, b) => a.start - b.start);

  return tokens;
}

/**
 * Check if delimiters are balanced in a string value.
 *
 * @param value - The string value to check
 * @returns Result indicating if delimiters are balanced
 */
export function validateDelimiters(value: string): DelimiterCheckResult {
  // Count opening and closing delimiters
  const openVars = (value.match(/\{\{/g) || []).length;
  const closeVars = (value.match(/\}\}/g) || []).length;
  const openExprs = (value.match(/\{%/g) || []).length;
  const closeExprs = (value.match(/%\}/g) || []).length;

  return {
    valid: openVars === closeVars && openExprs === closeExprs,
    unclosedVariables: openVars - closeVars,
    unclosedExpressions: openExprs - closeExprs,
  };
}

/**
 * Extract function calls from expression content.
 * Looks for identifier followed by opening parenthesis.
 *
 * @param exprContent - The inner content of a {% %} block
 * @returns Array of function calls found
 */
export function extractFunctionCalls(exprContent: string): FunctionCall[] {
  const calls: FunctionCall[] = [];
  const functionRegex = /\b([a-zA-Z_][a-zA-Z0-9_]*)\s*\(/g;
  let match;

  while ((match = functionRegex.exec(exprContent)) !== null) {
    calls.push({
      name: match[1],
      start: match.index,
      end: match.index + match[1].length,
    });
  }

  return calls;
}

/**
 * Extract bare identifiers from expression content.
 * Used to detect potential raw variables missing {{}}.
 *
 * @param exprContent - The inner content of a {% %} block
 * @returns Array of identifiers found
 */
export function extractIdentifiers(exprContent: string): Identifier[] {
  const identifiers: Identifier[] = [];

  // Replace {{...}} with placeholder to avoid matching variable contents
  const withoutVars = exprContent.replace(/\{\{[^}]*\}\}/g, match =>
    ' '.repeat(match.length)
  );

  // Replace string literals to avoid matching identifiers in strings
  const withoutStrings = withoutVars
    .replace(/"[^"]*"/g, match => ' '.repeat(match.length))
    .replace(/'[^']*'/g, match => ' '.repeat(match.length));

  // Find all identifiers
  const identifierRegex = /\b([a-zA-Z_][a-zA-Z0-9_]*)\b/g;
  let match;

  while ((match = identifierRegex.exec(withoutStrings)) !== null) {
    // Check if it's followed by ( (function call) - skip those
    const afterMatch = withoutStrings.slice(match.index + match[0].length);
    if (/^\s*\(/.test(afterMatch)) {
      continue;
    }

    // Check if it's preceded by ). (property access on function result) - skip those
    // e.g., date({{now}}).ts - the .ts is valid property access on function result
    if (match.index > 1 && withoutStrings[match.index - 1] === '.') {
      // Find the non-whitespace character before the dot
      let i = match.index - 2;
      while (i >= 0 && /\s/.test(withoutStrings[i])) {
        i--;
      }
      // Only skip if it's a closing paren (function call result)
      if (i >= 0 && withoutStrings[i] === ')') {
        continue;
      }
    }

    identifiers.push({
      name: match[1],
      start: match.index,
      end: match.index + match[1].length,
    });
  }

  return identifiers;
}

/**
 * Convert expression content to valid JavaScript for syntax checking.
 * Replaces {{var}} with valid JS identifiers and converts Nunjucks operators.
 *
 * @param exprContent - The inner content of a {% %} block
 * @returns JavaScript code that can be parsed
 */
export function toJavaScript(exprContent: string): string {
  let js = exprContent;

  // Replace {{...}} with a valid JS identifier
  js = js.replace(/\{\{[^}]+\}\}/g, '__var__');

  // Convert Nunjucks-style logical operators to JavaScript
  // Use word boundaries to avoid replacing inside identifiers
  js = js.replace(/\band\b/g, '&&');
  js = js.replace(/\bor\b/g, '||');
  js = js.replace(/\bnot\b/g, '!');

  return js;
}

/**
 * Visitor function type for string value traversal
 */
export type StringValueVisitor = (value: string, path: string) => void;

/**
 * Traverse all string values in an automation object.
 * Calls visitor for each string value found, with its JSON path.
 *
 * @param automation - The automation object to traverse
 * @param visitor - Function to call for each string value
 */
export function traverseStringValues(
  automation: unknown,
  visitor: StringValueVisitor
): void {
  function traverse(obj: unknown, path: string): void {
    if (obj === null || obj === undefined) {
      return;
    }

    if (typeof obj === 'string') {
      visitor(obj, path);
      return;
    }

    if (Array.isArray(obj)) {
      obj.forEach((item, index) => {
        traverse(item, `${path}[${index}]`);
      });
      return;
    }

    if (typeof obj === 'object') {
      Object.entries(obj).forEach(([key, value]) => {
        traverse(value, `${path}/${key}`);
      });
    }
  }

  traverse(automation, '');
}

/**
 * Check if a string contains any expression syntax.
 *
 * @param value - The string to check
 * @returns true if the string contains {{}} or {% %}
 */
export function hasExpressions(value: string): boolean {
  return /\{\{|\{%/.test(value);
}
