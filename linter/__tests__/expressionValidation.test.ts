import { validateExpressions } from '../src/expressionValidation';

describe('expression validation', () => {
  describe('delimiter validation', () => {
    it('should detect unclosed {{ variable references', () => {
      const automation = {
        name: 'test',
        do: [{ set: { name: 'x', value: '{{myVar' } }],
      };
      const errors = validateExpressions(automation);
      expect(errors.length).toBeGreaterThan(0);
      expect(errors[0].params?.expressionType).toBe('unclosedVariable');
    });

    it('should detect unclosed {% expression blocks', () => {
      const automation = {
        name: 'test',
        do: [{ set: { name: 'x', value: '{% {{a}} + 1' } }],
      };
      const errors = validateExpressions(automation);
      expect(errors.length).toBeGreaterThan(0);
      expect(errors[0].params?.expressionType).toBe('unclosedExpression');
    });

    it('should pass balanced delimiters', () => {
      const automation = {
        name: 'test',
        do: [{ set: { name: 'x', value: '{% {{a}} + {{b}} %}' } }],
      };
      const errors = validateExpressions(automation);
      // Should not have delimiter errors (may have other errors)
      const delimiterErrors = errors.filter(
        (e) =>
          e.params?.expressionType === 'unclosedVariable' ||
          e.params?.expressionType === 'unclosedExpression'
      );
      expect(delimiterErrors.length).toBe(0);
    });
  });

  describe('function validation', () => {
    it('should detect unknown functions', () => {
      const automation = {
        name: 'test',
        do: [{ set: { name: 'x', value: '{% now() %}' } }],
      };
      const errors = validateExpressions(automation);
      expect(errors.length).toBeGreaterThan(0);
      expect(errors[0].params?.expressionType).toBe('unknownFunction');
      expect(errors[0].params?.function).toBe('now');
    });

    it('should allow known functions', () => {
      const automation = {
        name: 'test',
        do: [{ set: { name: 'x', value: '{% date() %}' } }],
      };
      const errors = validateExpressions(automation);
      const functionErrors = errors.filter(
        (e) => e.params?.expressionType === 'unknownFunction'
      );
      expect(functionErrors.length).toBe(0);
    });

    it('should handle nested function calls', () => {
      const automation = {
        name: 'test',
        do: [{ set: { name: 'x', value: '{% json({{myObj}}) %}' } }],
      };
      const errors = validateExpressions(automation);
      const functionErrors = errors.filter(
        (e) => e.params?.expressionType === 'unknownFunction'
      );
      expect(functionErrors.length).toBe(0);
    });

    it('should detect unknown functions with arguments', () => {
      const automation = {
        name: 'test',
        do: [{ set: { name: 'x', value: '{% unknownFunc({{a}}, {{b}}) %}' } }],
      };
      const errors = validateExpressions(automation);
      expect(errors.length).toBeGreaterThan(0);
      expect(errors[0].params?.expressionType).toBe('unknownFunction');
    });
  });

  describe('raw variable detection', () => {
    it('should detect missing {{}} around variables in {% %}', () => {
      const automation = {
        name: 'test',
        do: [{ set: { name: 'x', value: '{% myVar + 1 %}' } }],
      };
      const errors = validateExpressions(automation);
      expect(errors.length).toBeGreaterThan(0);
      expect(errors[0].params?.expressionType).toBe('missingBrackets');
    });

    it('should not flag JS keywords as missing brackets', () => {
      const automation = {
        name: 'test',
        do: [{ set: { name: 'x', value: '{% {{a}} > 0 ? true : false %}' } }],
      };
      const errors = validateExpressions(automation);
      const bracketErrors = errors.filter(
        (e) => e.params?.expressionType === 'missingBrackets'
      );
      expect(bracketErrors.length).toBe(0);
    });

    it('should not flag function names as missing brackets', () => {
      const automation = {
        name: 'test',
        do: [{ set: { name: 'x', value: '{% date() %}' } }],
      };
      const errors = validateExpressions(automation);
      const bracketErrors = errors.filter(
        (e) => e.params?.expressionType === 'missingBrackets'
      );
      expect(bracketErrors.length).toBe(0);
    });

    it('should not flag numeric literals as missing brackets', () => {
      const automation = {
        name: 'test',
        do: [{ set: { name: 'x', value: '{% {{a}} + 1 %}' } }],
      };
      const errors = validateExpressions(automation);
      const bracketErrors = errors.filter(
        (e) => e.params?.expressionType === 'missingBrackets'
      );
      expect(bracketErrors.length).toBe(0);
    });

    it('should not flag property access after function calls', () => {
      const automation = {
        name: 'test',
        do: [
          { set: { name: 'x', value: '{% date({{now}}).ts + 300 %}' } },
          { set: { name: 'y', value: '{% date({{tokenExpiration}}).iso %}' } },
        ],
      };
      const errors = validateExpressions(automation);
      const bracketErrors = errors.filter(
        (e) => e.params?.expressionType === 'missingBrackets'
      );
      expect(bracketErrors.length).toBe(0);
    });

    it('should not flag string literals as missing brackets', () => {
      const automation = {
        name: 'test',
        do: [{ set: { name: 'x', value: '{% "hello" + {{name}} %}' } }],
      };
      const errors = validateExpressions(automation);
      const bracketErrors = errors.filter(
        (e) => e.params?.expressionType === 'missingBrackets'
      );
      expect(bracketErrors.length).toBe(0);
    });
  });

  describe('known function names used as bare variables', () => {
    it('should flag known function names when not used as function calls', () => {
      const automation = {
        name: 'test',
        do: [{ set: { name: 'x', value: '{% errors | length > 0 %}' } }],
      };
      const errors = validateExpressions(automation);
      const bracketErrors = errors.filter(
        (e) => e.params?.expressionType === 'missingBrackets'
      );
      // Both 'errors' and 'length' should be flagged as missing {{}}
      expect(bracketErrors.length).toBe(2);
    });

    it('should flag a || b when a and b are bare variables', () => {
      const automation = {
        name: 'test',
        do: [{ set: { name: 'x', value: '{% a || b %}' } }],
      };
      const errors = validateExpressions(automation);
      const bracketErrors = errors.filter(
        (e) => e.params?.expressionType === 'missingBrackets'
      );
      expect(bracketErrors.length).toBe(2);
    });

    it('should still allow known function names when used as function calls', () => {
      const automation = {
        name: 'test',
        do: [{ set: { name: 'x', value: '{% length({{errors}}) > 0 %}' } }],
      };
      const errors = validateExpressions(automation);
      const bracketErrors = errors.filter(
        (e) => e.params?.expressionType === 'missingBrackets'
      );
      expect(bracketErrors.length).toBe(0);
    });
  });

  describe('JS syntax validation', () => {
    it('should detect invalid operators', () => {
      // Note: +++ is actually valid JS (parsed as ++ +), so we use @@@ which is invalid
      const automation = {
        name: 'test',
        do: [{ set: { name: 'x', value: '{% {{a}} @@@ {{b}} %}' } }],
      };
      const errors = validateExpressions(automation);
      expect(errors.length).toBeGreaterThan(0);
      expect(errors[0].params?.expressionType).toBe('invalidSyntax');
    });

    it('should allow valid expressions', () => {
      const automation = {
        name: 'test',
        do: [{ set: { name: 'x', value: '{% {{a}} + {{b}} * 2 %}' } }],
      };
      const errors = validateExpressions(automation);
      const syntaxErrors = errors.filter(
        (e) => e.params?.expressionType === 'invalidSyntax'
      );
      expect(syntaxErrors.length).toBe(0);
    });

    it('should allow comparison operators', () => {
      const automation = {
        name: 'test',
        do: [
          { set: { name: 'x', value: '{% {{a}} > {{b}} && {{c}} == {{d}} %}' } },
        ],
      };
      const errors = validateExpressions(automation);
      const syntaxErrors = errors.filter(
        (e) => e.params?.expressionType === 'invalidSyntax'
      );
      expect(syntaxErrors.length).toBe(0);
    });

    it('should allow ternary operator', () => {
      const automation = {
        name: 'test',
        do: [{ set: { name: 'x', value: '{% {{a}} ? {{b}} : {{c}} %}' } }],
      };
      const errors = validateExpressions(automation);
      const syntaxErrors = errors.filter(
        (e) => e.params?.expressionType === 'invalidSyntax'
      );
      expect(syntaxErrors.length).toBe(0);
    });
  });

  describe('nested instruction traversal', () => {
    it('should validate expressions in conditions blocks', () => {
      const automation = {
        name: 'test',
        do: [
          {
            conditions: {
              '{% true %}': [
                { set: { name: 'x', value: '{% unknownFunc() %}' } },
              ],
              default: [],
            },
          },
        ],
      };
      const errors = validateExpressions(automation);
      expect(errors.length).toBeGreaterThan(0);
      expect(errors[0].params?.expressionType).toBe('unknownFunction');
    });

    it('should validate expressions in repeat blocks', () => {
      const automation = {
        name: 'test',
        do: [
          {
            repeat: {
              on: '{{items}}',
              do: [{ set: { name: 'x', value: '{{myVar' } }],
            },
          },
        ],
      };
      const errors = validateExpressions(automation);
      expect(errors.length).toBeGreaterThan(0);
      expect(errors[0].params?.expressionType).toBe('unclosedVariable');
    });

    it('should validate expressions in try/catch blocks', () => {
      const automation = {
        name: 'test',
        do: [
          {
            try: {
              do: [{ set: { name: 'x', value: '{% badFunc() %}' } }],
              catch: [{ set: { name: 'err', value: '{{error}}' } }],
            },
          },
        ],
      };
      const errors = validateExpressions(automation);
      expect(errors.length).toBeGreaterThan(0);
    });

    it('should validate expressions in all (parallel) blocks', () => {
      const automation = {
        name: 'test',
        do: [
          {
            all: [
              { set: { name: 'x', value: '{% now() %}' } },
              { set: { name: 'y', value: '{{valid}}' } },
            ],
          },
        ],
      };
      const errors = validateExpressions(automation);
      expect(errors.length).toBeGreaterThan(0);
      expect(errors[0].params?.expressionType).toBe('unknownFunction');
    });
  });

  describe('error object format', () => {
    it('should return Ajv-compatible ErrorObject shape', () => {
      const automation = {
        name: 'test',
        do: [{ set: { name: 'x', value: '{{myVar' } }],
      };
      const errors = validateExpressions(automation);
      expect(errors.length).toBeGreaterThan(0);

      const error = errors[0];
      expect(error).toHaveProperty('keyword', 'expression');
      expect(error).toHaveProperty('instancePath');
      expect(error).toHaveProperty('schemaPath');
      expect(error).toHaveProperty('params');
      expect(error).toHaveProperty('message');
    });

    it('should include correct instancePath for nested errors', () => {
      const automation = {
        name: 'test',
        do: [
          { set: { name: 'a', value: 'valid' } },
          { set: { name: 'b', value: '{{unclosed' } },
        ],
      };
      const errors = validateExpressions(automation);
      expect(errors.length).toBeGreaterThan(0);
      expect(errors[0].instancePath).toContain('/do');
    });
  });

  describe('operator in variable detection', () => {
    it('should detect arithmetic operators inside {{}}', () => {
      const automation = {
        name: 'test',
        do: [{ set: { name: 'x', value: '{{user.groups.length - 1}}' } }],
      };
      const errors = validateExpressions(automation);
      const opErrors = errors.filter(
        (e) => e.params?.expressionType === 'operatorInVariable'
      );
      expect(opErrors.length).toBe(1);
    });

    it('should detect addition operator inside {{}}', () => {
      const automation = {
        name: 'test',
        do: [{ set: { name: 'x', value: '{{a + b}}' } }],
      };
      const errors = validateExpressions(automation);
      const opErrors = errors.filter(
        (e) => e.params?.expressionType === 'operatorInVariable'
      );
      expect(opErrors.length).toBe(1);
    });

    it('should detect comparison operators inside {{}}', () => {
      const automation = {
        name: 'test',
        do: [{ set: { name: 'x', value: '{{a >= b}}' } }],
      };
      const errors = validateExpressions(automation);
      const opErrors = errors.filter(
        (e) => e.params?.expressionType === 'operatorInVariable'
      );
      expect(opErrors.length).toBe(1);
    });

    it('should not flag simple variable references', () => {
      const automation = {
        name: 'test',
        do: [{ set: { name: 'x', value: '{{user.email}}' } }],
      };
      const errors = validateExpressions(automation);
      const opErrors = errors.filter(
        (e) => e.params?.expressionType === 'operatorInVariable'
      );
      expect(opErrors.length).toBe(0);
    });

    it('should not flag bracket access with numeric index', () => {
      const automation = {
        name: 'test',
        do: [{ set: { name: 'x', value: '{{items[0]}}' } }],
      };
      const errors = validateExpressions(automation);
      const opErrors = errors.filter(
        (e) => e.params?.expressionType === 'operatorInVariable'
      );
      expect(opErrors.length).toBe(0);
    });

    it('should not flag bracket access with string key', () => {
      const automation = {
        name: 'test',
        do: [{ set: { name: 'x', value: '{{obj["key"]}}' } }],
      };
      const errors = validateExpressions(automation);
      const opErrors = errors.filter(
        (e) => e.params?.expressionType === 'operatorInVariable'
      );
      expect(opErrors.length).toBe(0);
    });
  });

  describe('object literal detection', () => {
    it('should detect object literal with fallback pattern', () => {
      const automation = {
        name: 'test',
        do: [{ set: { name: 'x', value: '{% {{sort}} || {"createdAt": -1} %}' } }],
      };
      const errors = validateExpressions(automation);
      const objErrors = errors.filter(
        (e) => e.params?.expressionType === 'objectLiteralInExpression'
      );
      expect(objErrors.length).toBe(1);
    });

    it('should detect standalone object literal', () => {
      const automation = {
        name: 'test',
        do: [{ set: { name: 'x', value: '{% {"key": "value"} %}' } }],
      };
      const errors = validateExpressions(automation);
      const objErrors = errors.filter(
        (e) => e.params?.expressionType === 'objectLiteralInExpression'
      );
      expect(objErrors.length).toBe(1);
    });

    it('should detect empty object literal', () => {
      const automation = {
        name: 'test',
        do: [{ set: { name: 'x', value: '{% {{a}} || {} %}' } }],
      };
      const errors = validateExpressions(automation);
      const objErrors = errors.filter(
        (e) => e.params?.expressionType === 'objectLiteralInExpression'
      );
      expect(objErrors.length).toBe(1);
    });

    it('should allow simple numeric fallback', () => {
      const automation = {
        name: 'test',
        do: [{ set: { name: 'x', value: '{% {{sort}} || 20 %}' } }],
      };
      const errors = validateExpressions(automation);
      const objErrors = errors.filter(
        (e) => e.params?.expressionType === 'objectLiteralInExpression'
      );
      expect(objErrors.length).toBe(0);
    });

    it('should allow arithmetic expressions', () => {
      const automation = {
        name: 'test',
        do: [{ set: { name: 'x', value: '{% {{a}} + {{b}} %}' } }],
      };
      const errors = validateExpressions(automation);
      const objErrors = errors.filter(
        (e) => e.params?.expressionType === 'objectLiteralInExpression'
      );
      expect(objErrors.length).toBe(0);
    });

    it('should allow function calls with property access', () => {
      const automation = {
        name: 'test',
        do: [{ set: { name: 'x', value: '{% date({{now}}).ts %}' } }],
      };
      const errors = validateExpressions(automation);
      const objErrors = errors.filter(
        (e) => e.params?.expressionType === 'objectLiteralInExpression'
      );
      expect(objErrors.length).toBe(0);
    });

    it('should not flag braces inside string literals', () => {
      const automation = {
        name: 'test',
        do: [{ set: { name: 'x', value: '{% "text with {braces}" %}' } }],
      };
      const errors = validateExpressions(automation);
      const objErrors = errors.filter(
        (e) => e.params?.expressionType === 'objectLiteralInExpression'
      );
      expect(objErrors.length).toBe(0);
    });
  });

  describe('edge cases', () => {
    it('should skip empty string values', () => {
      const automation = {
        name: 'test',
        do: [{ set: { name: 'x', value: '' } }],
      };
      const errors = validateExpressions(automation);
      expect(errors.length).toBe(0);
    });

    it('should skip strings without expressions', () => {
      const automation = {
        name: 'test',
        do: [{ set: { name: 'x', value: 'plain text' } }],
      };
      const errors = validateExpressions(automation);
      expect(errors.length).toBe(0);
    });

    it('should handle multiple errors in same value', () => {
      const automation = {
        name: 'test',
        do: [{ set: { name: 'x', value: '{% myVar + now() %}' } }],
      };
      const errors = validateExpressions(automation);
      // Should detect both: missingBrackets for myVar AND unknownFunction for now()
      expect(errors.length).toBeGreaterThanOrEqual(2);
    });

    it('should validate expressions in non-do fields (output, arguments)', () => {
      const automation = {
        name: 'test',
        do: [{ set: { name: 'x', value: 1 } }],
        output: '{% unknownFunc() %}',
      };
      const errors = validateExpressions(automation);
      expect(errors.length).toBeGreaterThan(0);
    });

    it('should handle deeply nested objects', () => {
      const automation = {
        name: 'test',
        do: [
          {
            fetch: {
              url: 'http://example.com',
              body: {
                nested: {
                  deep: {
                    value: '{{unclosed',
                  },
                },
              },
            },
          },
        ],
      };
      const errors = validateExpressions(automation);
      expect(errors.length).toBeGreaterThan(0);
    });
  });
});
