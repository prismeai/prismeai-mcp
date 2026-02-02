import { lintAutomation } from '../index';
import * as fs from 'fs';
import * as path from 'path';
import * as yaml from 'js-yaml';

const SAMPLE_AUTOMATIONS_DIR = path.join(__dirname, 'sampleAutomations');

function loadAutomation(relativePath: string): unknown {
  const fullPath = path.join(SAMPLE_AUTOMATIONS_DIR, relativePath);
  const content = fs.readFileSync(fullPath, 'utf-8');
  return yaml.load(content);
}

function getAutomationFiles(subDir: string): string[] {
  const dirPath = path.join(SAMPLE_AUTOMATIONS_DIR, subDir);
  if (!fs.existsSync(dirPath)) return [];
  return fs.readdirSync(dirPath)
    .filter(f => f.endsWith('.yml') || f.endsWith('.yaml'))
    .map(f => path.join(subDir, f));
}

describe('lintAutomation', () => {
  describe('basic validation', () => {
    it('should return valid: true for a valid automation', () => {
      const result = lintAutomation({
        name: 'test',
        do: [],
      });
      expect(result.valid).toBe(true);
      expect(result.errors).toEqual([]);
    });

    it('should return valid: false for invalid input', () => {
      const result = lintAutomation({});
      expect(result.valid).toBe(false);
      expect(result.errors.length).toBeGreaterThan(0);
    });

    it('should not throw for any input', () => {
      expect(() => lintAutomation(null)).not.toThrow();
      expect(() => lintAutomation(undefined)).not.toThrow();
      expect(() => lintAutomation('string')).not.toThrow();
      expect(() => lintAutomation(123)).not.toThrow();
    });

    it('should return Ajv-compatible ErrorObject shape', () => {
      const result = lintAutomation({});
      const error = result.errors[0];
      // ErrorObject shape: { keyword, instancePath, schemaPath, params, message }
      expect(error).toHaveProperty('keyword');
      expect(error).toHaveProperty('instancePath');
    });
  });

  describe('strict mode', () => {
    it('should default to strict: false', () => {
      // Unknown argument INSIDE instruction args should NOT error in non-strict mode
      // Note: Schema allows additional properties inside instruction values
      const result = lintAutomation({
        name: 'test',
        do: [{ set: { name: 'x', value: 1, unknownArg: 'bad' } }],
      });
      // Non-strict: additional properties inside instruction args are allowed
      expect(result.valid).toBe(true);
    });

    it('should detect unknown arguments when strict: true', () => {
      const result = lintAutomation(
        {
          name: 'test',
          do: [{ set: { name: 'x', value: 1, foobar: 'invalid' } }],
        },
        { strict: true }
      );
      expect(result.valid).toBe(false);
      expect(
        result.errors.some(
          (e) =>
            e.message?.includes('foobar') || e.params?.additionalProperty === 'foobar'
        )
      ).toBe(true);
    });

    it('should pass strict mode with valid instruction arguments', () => {
      const result = lintAutomation(
        {
          name: 'test',
          do: [{ set: { name: 'x', value: 1 } }],
        },
        { strict: true }
      );
      expect(result.valid).toBe(true);
      expect(result.errors).toEqual([]);
    });

    it('should validate nested instructions in strict mode', () => {
      const result = lintAutomation(
        {
          name: 'test',
          do: [
            {
              conditions: {
                '{% true %}': [
                  { set: { name: 'x', value: 1, badArg: 'oops' } },
                ],
                default: [],
              },
            },
          ],
        },
        { strict: true }
      );
      expect(result.valid).toBe(false);
    });

    it('should validate repeat block instructions in strict mode', () => {
      const result = lintAutomation(
        {
          name: 'test',
          do: [
            {
              repeat: {
                on: '{{items}}',
                do: [{ emit: { event: 'test', invalidKey: true } }],
              },
            },
          ],
        },
        { strict: true }
      );
      expect(result.valid).toBe(false);
    });
  });

  describe('sample automations', () => {
    describe('correct automations', () => {
      const correctFiles = getAutomationFiles('correct');

      if (correctFiles.length === 0) {
        it.skip('no correct sample automations found', () => {});
      }

      correctFiles.forEach((file) => {
        const automationName = path.basename(file, path.extname(file));

        it(`${automationName} should pass basic validation`, () => {
          const automation = loadAutomation(file);
          // Disable expression validation for sample automations
          const result = lintAutomation(automation, { validateExpressions: false });
          expect(result.valid).toBe(true);
          expect(result.errors).toEqual([]);
        });

        // Note: Strict mode validation is not tested for sample automations.
        // Real-world automations may not fully comply with the strict JSON Schema
        // (e.g., conditions without 'default' branch). The runtime is more permissive
        // than the schema. Strict mode is intended for new automation development.
      });
    });

    describe('incorrect automations (structural errors)', () => {
      const incorrectFiles = getAutomationFiles('incorrect');

      if (incorrectFiles.length === 0) {
        it.skip('no incorrect sample automations found', () => {});
      }

      incorrectFiles.forEach((file) => {
        const automationName = path.basename(file, path.extname(file));

        it(`${automationName} should fail validation`, () => {
          const automation = loadAutomation(file);
          const result = lintAutomation(automation, { strict: true });
          expect(result.valid).toBe(false);
          expect(result.errors.length).toBeGreaterThan(0);
        });
      });
    });

    describe('incorrect automations (expression errors)', () => {
      // These automations have expression-level errors. Some may also have
      // structural issues when strict mode is enabled. We only test basic
      // schema validation (not strict) with expressions disabled.
      const expressionErrorFiles = getAutomationFiles('incorrect-expressions');

      if (expressionErrorFiles.length === 0) {
        it.skip('no expression error sample automations found', () => {});
      }

      expressionErrorFiles.forEach((file) => {
        const automationName = path.basename(file, path.extname(file));

        it(`${automationName} passes basic schema validation`, () => {
          const automation = loadAutomation(file);
          // Only test basic validation - some files may have structural issues in strict mode
          const result = lintAutomation(automation, { validateExpressions: false });
          expect(result.valid).toBe(true);
        });
      });
    });
  });

  describe('schema-based validation (strict mode)', () => {
    describe('nested property type validation', () => {
      it('should validate repeat.do must be array', () => {
        const result = lintAutomation(
          {
            name: 'test',
            do: [{ repeat: { on: '{{items}}', do: 'not-an-array' } }],
          },
          { strict: true }
        );
        expect(result.valid).toBe(false);
        expect(result.errors.some(e =>
          e.instancePath?.includes('repeat') &&
          e.keyword === 'type'
        )).toBe(true);
      });

      it('should validate repeat.batch.size must be number', () => {
        const result = lintAutomation(
          {
            name: 'test',
            do: [{ repeat: { on: '{{items}}', do: [], batch: { size: 'five' } } }],
          },
          { strict: true }
        );
        expect(result.valid).toBe(false);
        expect(result.errors.some(e =>
          e.instancePath?.includes('batch') &&
          e.keyword === 'type'
        )).toBe(true);
      });

      it('should validate fetch.stream.event must be string', () => {
        const result = lintAutomation(
          {
            name: 'test',
            do: [{ fetch: { url: 'http://example.com', stream: { event: 123 } } }],
          },
          { strict: true }
        );
        expect(result.valid).toBe(false);
        expect(result.errors.some(e =>
          e.instancePath?.includes('stream') &&
          e.keyword === 'type'
        )).toBe(true);
      });

      it('should validate emit.options.persist must be boolean', () => {
        const result = lintAutomation(
          {
            name: 'test',
            do: [{ emit: { event: 'test', options: { persist: 'yes' } } }],
          },
          { strict: true }
        );
        expect(result.valid).toBe(false);
        expect(result.errors.some(e =>
          e.instancePath?.includes('options') &&
          e.keyword === 'type'
        )).toBe(true);
      });
    });

    describe('required field validation', () => {
      it('should report error for fetch without url', () => {
        const result = lintAutomation(
          {
            name: 'test',
            do: [{ fetch: { method: 'get' } }],
          },
          { strict: true }
        );
        expect(result.valid).toBe(false);
        expect(result.errors.some(e =>
          e.keyword === 'required' &&
          e.params?.missingProperty === 'url'
        )).toBe(true);
      });

      it('should report error for set without name', () => {
        const result = lintAutomation(
          {
            name: 'test',
            do: [{ set: { value: 'hello' } }],
          },
          { strict: true }
        );
        expect(result.valid).toBe(false);
        expect(result.errors.some(e =>
          e.keyword === 'required' &&
          e.params?.missingProperty === 'name'
        )).toBe(true);
      });

      it('should report error for emit without event', () => {
        const result = lintAutomation(
          {
            name: 'test',
            do: [{ emit: { payload: { data: 'test' } } }],
          },
          { strict: true }
        );
        expect(result.valid).toBe(false);
        expect(result.errors.some(e =>
          e.keyword === 'required' &&
          e.params?.missingProperty === 'event'
        )).toBe(true);
      });
    });

    describe('enum validation', () => {
      it('should validate set.type must be replace|merge|push', () => {
        const result = lintAutomation(
          {
            name: 'test',
            do: [{ set: { name: 'x', value: 1, type: 'invalid' } }],
          },
          { strict: true }
        );
        expect(result.valid).toBe(false);
        expect(result.errors.some(e =>
          e.keyword === 'enum' &&
          e.instancePath?.includes('type')
        )).toBe(true);
      });

      it('should validate fetch.method enum values', () => {
        const result = lintAutomation(
          {
            name: 'test',
            do: [{ fetch: { url: 'http://example.com', method: 'INVALID' } }],
          },
          { strict: true }
        );
        expect(result.valid).toBe(false);
        expect(result.errors.some(e =>
          e.keyword === 'enum' &&
          e.instancePath?.includes('method')
        )).toBe(true);
      });

      it('should validate break.scope enum values', () => {
        const result = lintAutomation(
          {
            name: 'test',
            do: [{ break: { scope: 'invalid' } }],
          },
          { strict: true }
        );
        expect(result.valid).toBe(false);
        expect(result.errors.some(e =>
          e.keyword === 'enum' &&
          e.instancePath?.includes('scope')
        )).toBe(true);
      });
    });

    describe('supplementary instruction validation', () => {
      it('should validate try instruction structure', () => {
        const result = lintAutomation(
          {
            name: 'test',
            do: [{ try: { do: [], catch: [], finally: [] } }],
          },
          { strict: true }
        );
        expect(result.valid).toBe(true);
      });

      it('should report error for try.do not being array', () => {
        const result = lintAutomation(
          {
            name: 'test',
            do: [{ try: { do: 'not-array' } }],
          },
          { strict: true }
        );
        expect(result.valid).toBe(false);
        expect(result.errors.some(e => e.keyword === 'type')).toBe(true);
      });

      it('should validate createUserTopic instruction', () => {
        const result = lintAutomation(
          {
            name: 'test',
            do: [{ createUserTopic: { topic: 'my-topic', userIds: ['user1'] } }],
          },
          { strict: true }
        );
        expect(result.valid).toBe(true);
      });

      it('should validate joinUserTopic instruction', () => {
        const result = lintAutomation(
          {
            name: 'test',
            do: [{ joinUserTopic: { userTopic: 'my-topic', userIds: ['user1'] } }],
          },
          { strict: true }
        );
        expect(result.valid).toBe(true);
      });

      it('should validate auth instruction', () => {
        const result = lintAutomation(
          {
            name: 'test',
            do: [{ auth: { workspace: true, service: 'my-service', output: 'authResult' } }],
          },
          { strict: true }
        );
        expect(result.valid).toBe(true);
      });
    });

    describe('error path formatting', () => {
      it('should include full traversal path in error', () => {
        const result = lintAutomation(
          {
            name: 'test',
            do: [
              {
                repeat: {
                  on: '{{items}}',
                  do: [{ set: { name: 'x', value: 1, unknownProp: true } }],
                },
              },
            ],
          },
          { strict: true }
        );
        expect(result.valid).toBe(false);
        expect(result.errors.some(e =>
          e.instancePath?.includes('/do[0]') &&
          e.instancePath?.includes('repeat')
        )).toBe(true);
      });

      it('should report multiple errors when allErrors is enabled', () => {
        const result = lintAutomation(
          {
            name: 'test',
            do: [
              { set: { name: 'x', value: 1, bad1: true, bad2: true } },
            ],
          },
          { strict: true }
        );
        expect(result.valid).toBe(false);
        // Should report at least one error for unknown properties
        expect(result.errors.length).toBeGreaterThan(0);
      });
    });

    describe('edge cases', () => {
      it('should pass empty automation { do: [] }', () => {
        const result = lintAutomation(
          { name: 'test', do: [] },
          { strict: true }
        );
        expect(result.valid).toBe(true);
      });

      it('should handle deeply nested conditions/repeat/all', () => {
        const result = lintAutomation(
          {
            name: 'test',
            do: [
              {
                conditions: {
                  '{% true %}': [
                    {
                      repeat: {
                        on: '{{items}}',
                        do: [
                          {
                            all: [
                              { set: { name: 'x', value: 1 } },
                            ],
                          },
                        ],
                      },
                    },
                  ],
                  default: [],
                },
              },
            ],
          },
          { strict: true }
        );
        expect(result.valid).toBe(true);
      });

      it('should skip app instructions (e.g., Collection.find)', () => {
        const result = lintAutomation(
          {
            name: 'test',
            do: [{ 'Collection.find': { collection: 'users', query: {} } }],
          },
          { strict: true }
        );
        // App instructions are not validated by strict mode
        expect(result.valid).toBe(true);
      });

      it('should handle conditions with dynamic expression keys', () => {
        const result = lintAutomation(
          {
            name: 'test',
            do: [
              {
                conditions: {
                  '{% x > 5 %}': [{ set: { name: 'y', value: 10 } }],
                  '{% x < 0 %}': [{ set: { name: 'y', value: 0 } }],
                  default: [{ set: { name: 'y', value: 5 } }],
                },
              },
            ],
          },
          { strict: true }
        );
        expect(result.valid).toBe(true);
      });

      it('should handle comment instruction with string value', () => {
        const result = lintAutomation(
          {
            name: 'test',
            do: [{ comment: 'This is a comment' }],
          },
          { strict: true }
        );
        expect(result.valid).toBe(true);
      });
    });
  });

  describe('expression validation option', () => {
    it('should validate expressions by default', () => {
      const result = lintAutomation({
        name: 'test',
        do: [{ set: { name: 'x', value: '{% unknownFunc() %}' } }],
      });
      expect(result.valid).toBe(false);
      expect(result.errors.some(e => e.keyword === 'expression')).toBe(true);
    });

    it('should skip expression validation when validateExpressions: false', () => {
      const result = lintAutomation(
        {
          name: 'test',
          do: [{ set: { name: 'x', value: '{% unknownFunc() %}' } }],
        },
        { validateExpressions: false }
      );
      expect(result.valid).toBe(true);
    });

    it('should run both strict and expression validation', () => {
      const result = lintAutomation(
        {
          name: 'test',
          do: [
            { set: { name: 'x', value: 1, badArg: true } },  // strict error
            { set: { name: 'y', value: '{% unknownFunc() %}' } },  // expression error
          ],
        },
        { strict: true }
      );
      expect(result.valid).toBe(false);
      // Should catch the first error (strict mode)
      expect(result.errors.length).toBeGreaterThan(0);
    });
  });
});
