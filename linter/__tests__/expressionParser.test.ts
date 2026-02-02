import {
  extractExpressions,
  validateDelimiters,
  extractFunctionCalls,
  extractIdentifiers,
  toJavaScript,
  traverseStringValues,
  hasExpressions,
} from '../src/expressionParser';

describe('expressionParser', () => {
  describe('extractExpressions', () => {
    it('should return 2 variable tokens for "{{a}} + {{b}}"', () => {
      const tokens = extractExpressions('{{a}} + {{b}}');
      expect(tokens).toHaveLength(2);
      expect(tokens[0].type).toBe('variable');
      expect(tokens[0].innerContent).toBe('a');
      expect(tokens[1].type).toBe('variable');
      expect(tokens[1].innerContent).toBe('b');
    });

    it('should return 1 expression token with nested variable for "{% {{a}} + 1 %}"', () => {
      const tokens = extractExpressions('{% {{a}} + 1 %}');
      expect(tokens).toHaveLength(1);
      expect(tokens[0].type).toBe('expression');
      expect(tokens[0].innerContent).toBe(' {{a}} + 1 ');
    });

    it('should handle mixed variable and expression blocks', () => {
      const tokens = extractExpressions('{{x}} + {% {{y}} * 2 %}');
      expect(tokens).toHaveLength(2);
      expect(tokens[0].type).toBe('variable');
      expect(tokens[1].type).toBe('expression');
    });

    it('should return tokens sorted by position', () => {
      const tokens = extractExpressions('{% first %} and {{second}}');
      expect(tokens).toHaveLength(2);
      expect(tokens[0].start).toBeLessThan(tokens[1].start);
    });

    it('should return empty array for plain string', () => {
      const tokens = extractExpressions('plain text');
      expect(tokens).toHaveLength(0);
    });

    it('should capture full content and inner content correctly', () => {
      const tokens = extractExpressions('{{myVar}}');
      expect(tokens[0].content).toBe('{{myVar}}');
      expect(tokens[0].innerContent).toBe('myVar');
      expect(tokens[0].start).toBe(0);
      expect(tokens[0].end).toBe(9);
    });

    it('should handle expressions containing % characters', () => {
      const tokens = extractExpressions('{% 50% discount %}');
      expect(tokens).toHaveLength(1);
      expect(tokens[0].innerContent).toBe(' 50% discount ');
    });
  });

  describe('validateDelimiters', () => {
    it('should return valid: true for "{{a}}"', () => {
      const result = validateDelimiters('{{a}}');
      expect(result.valid).toBe(true);
      expect(result.unclosedVariables).toBe(0);
      expect(result.unclosedExpressions).toBe(0);
    });

    it('should return valid: false, unclosedVariables: 1 for "{{a"', () => {
      const result = validateDelimiters('{{a');
      expect(result.valid).toBe(false);
      expect(result.unclosedVariables).toBe(1);
    });

    it('should return valid: false, unclosedExpressions: 1 for "{% a"', () => {
      const result = validateDelimiters('{% a');
      expect(result.valid).toBe(false);
      expect(result.unclosedExpressions).toBe(1);
    });

    it('should handle multiple balanced delimiters', () => {
      const result = validateDelimiters('{{a}} + {{b}} + {% c %}');
      expect(result.valid).toBe(true);
    });

    it('should detect multiple unclosed delimiters', () => {
      const result = validateDelimiters('{{a {{ {% b');
      expect(result.valid).toBe(false);
      expect(result.unclosedVariables).toBe(2);
      expect(result.unclosedExpressions).toBe(1);
    });

    it('should handle extra closing delimiters', () => {
      const result = validateDelimiters('a}} b%}');
      expect(result.valid).toBe(false);
      expect(result.unclosedVariables).toBe(-1);
      expect(result.unclosedExpressions).toBe(-1);
    });
  });

  describe('extractFunctionCalls', () => {
    it('should return 2 function calls for "date() + uuid()"', () => {
      const calls = extractFunctionCalls('date() + uuid()');
      expect(calls).toHaveLength(2);
      expect(calls[0].name).toBe('date');
      expect(calls[1].name).toBe('uuid');
    });

    it('should handle functions with arguments', () => {
      const calls = extractFunctionCalls('round({{value}}, 2)');
      expect(calls).toHaveLength(1);
      expect(calls[0].name).toBe('round');
    });

    it('should handle nested function calls', () => {
      const calls = extractFunctionCalls('json(trim({{value}}))');
      expect(calls).toHaveLength(2);
      expect(calls.map(c => c.name)).toEqual(['json', 'trim']);
    });

    it('should capture correct positions', () => {
      const calls = extractFunctionCalls('date()');
      expect(calls[0].start).toBe(0);
      expect(calls[0].end).toBe(4);
    });

    it('should handle functions with whitespace before parenthesis', () => {
      const calls = extractFunctionCalls('date  ()');
      expect(calls).toHaveLength(1);
      expect(calls[0].name).toBe('date');
    });

    it('should return empty array when no functions', () => {
      const calls = extractFunctionCalls('{{a}} + {{b}}');
      expect(calls).toHaveLength(0);
    });
  });

  describe('extractIdentifiers', () => {
    it('should return identifier for "myVar" in "myVar + 1"', () => {
      const identifiers = extractIdentifiers('myVar + 1');
      expect(identifiers).toHaveLength(1);
      expect(identifiers[0].name).toBe('myVar');
    });

    it('should return identifier only for "x" (not "date") in "date() + x"', () => {
      const identifiers = extractIdentifiers('date() + x');
      expect(identifiers).toHaveLength(1);
      expect(identifiers[0].name).toBe('x');
    });

    it('should not match identifiers inside {{}}', () => {
      const identifiers = extractIdentifiers('{{myVar}} + x');
      expect(identifiers).toHaveLength(1);
      expect(identifiers[0].name).toBe('x');
    });

    it('should not match identifiers inside string literals', () => {
      const identifiers = extractIdentifiers('"hello" + x');
      expect(identifiers).toHaveLength(1);
      expect(identifiers[0].name).toBe('x');
    });

    it('should not match identifiers inside single-quoted strings', () => {
      const identifiers = extractIdentifiers("'hello' + x");
      expect(identifiers).toHaveLength(1);
      expect(identifiers[0].name).toBe('x');
    });

    it('should handle multiple identifiers', () => {
      const identifiers = extractIdentifiers('a + b + c');
      expect(identifiers).toHaveLength(3);
      expect(identifiers.map(i => i.name)).toEqual(['a', 'b', 'c']);
    });

    it('should capture correct positions', () => {
      const identifiers = extractIdentifiers('myVar');
      expect(identifiers[0].start).toBe(0);
      expect(identifiers[0].end).toBe(5);
    });

    it('should handle identifiers with underscores and numbers', () => {
      const identifiers = extractIdentifiers('my_var2 + _test');
      expect(identifiers).toHaveLength(2);
      expect(identifiers.map(i => i.name)).toEqual(['my_var2', '_test']);
    });
  });

  describe('toJavaScript', () => {
    it('should convert "{{a}} + {{b}}" to "__var__ + __var__"', () => {
      const result = toJavaScript('{{a}} + {{b}}');
      expect(result).toBe('__var__ + __var__');
    });

    it('should handle complex expressions', () => {
      const result = toJavaScript('{{user.name}} ? {{user.id}} : "default"');
      expect(result).toBe('__var__ ? __var__ : "default"');
    });

    it('should preserve non-variable parts', () => {
      const result = toJavaScript('date() + 1');
      expect(result).toBe('date() + 1');
    });

    it('should handle nested variables in expressions', () => {
      const result = toJavaScript('{{a}} + {{b}} * {{c}}');
      expect(result).toBe('__var__ + __var__ * __var__');
    });
  });

  describe('traverseStringValues', () => {
    it('should call visitor with "test" for {a: {b: "test"}}', () => {
      const visitor = jest.fn();
      traverseStringValues({ a: { b: 'test' } }, visitor);
      expect(visitor).toHaveBeenCalledWith('test', '/a/b');
    });

    it('should visit all string values in nested objects', () => {
      const visitor = jest.fn();
      traverseStringValues(
        {
          name: 'hello',
          nested: { value: 'world' },
        },
        visitor
      );
      expect(visitor).toHaveBeenCalledTimes(2);
      expect(visitor).toHaveBeenCalledWith('hello', '/name');
      expect(visitor).toHaveBeenCalledWith('world', '/nested/value');
    });

    it('should visit string values in arrays', () => {
      const visitor = jest.fn();
      traverseStringValues({ items: ['a', 'b', 'c'] }, visitor);
      expect(visitor).toHaveBeenCalledTimes(3);
      expect(visitor).toHaveBeenCalledWith('a', '/items[0]');
      expect(visitor).toHaveBeenCalledWith('b', '/items[1]');
      expect(visitor).toHaveBeenCalledWith('c', '/items[2]');
    });

    it('should handle mixed arrays and objects', () => {
      const visitor = jest.fn();
      traverseStringValues(
        {
          do: [{ set: { name: 'x', value: 'test' } }],
        },
        visitor
      );
      expect(visitor).toHaveBeenCalledWith('x', '/do[0]/set/name');
      expect(visitor).toHaveBeenCalledWith('test', '/do[0]/set/value');
    });

    it('should skip null and undefined values', () => {
      const visitor = jest.fn();
      traverseStringValues({ a: null, b: undefined, c: 'test' }, visitor);
      expect(visitor).toHaveBeenCalledTimes(1);
      expect(visitor).toHaveBeenCalledWith('test', '/c');
    });

    it('should skip non-string primitives', () => {
      const visitor = jest.fn();
      traverseStringValues({ a: 1, b: true, c: 'test' }, visitor);
      expect(visitor).toHaveBeenCalledTimes(1);
      expect(visitor).toHaveBeenCalledWith('test', '/c');
    });

    it('should handle top-level string', () => {
      const visitor = jest.fn();
      traverseStringValues('hello', visitor);
      expect(visitor).toHaveBeenCalledWith('hello', '');
    });

    it('should handle top-level array', () => {
      const visitor = jest.fn();
      traverseStringValues(['a', 'b'], visitor);
      expect(visitor).toHaveBeenCalledWith('a', '[0]');
      expect(visitor).toHaveBeenCalledWith('b', '[1]');
    });
  });

  describe('hasExpressions', () => {
    it('should return false for "plain"', () => {
      expect(hasExpressions('plain')).toBe(false);
    });

    it('should return true for "{{var}}"', () => {
      expect(hasExpressions('{{var}}')).toBe(true);
    });

    it('should return true for "{% expr %}"', () => {
      expect(hasExpressions('{% expr %}')).toBe(true);
    });

    it('should return true for mixed content', () => {
      expect(hasExpressions('Hello {{name}}')).toBe(true);
    });

    it('should return false for empty string', () => {
      expect(hasExpressions('')).toBe(false);
    });

    it('should detect partial delimiters', () => {
      expect(hasExpressions('{{unclosed')).toBe(true);
      expect(hasExpressions('{% unclosed')).toBe(true);
    });
  });
});
