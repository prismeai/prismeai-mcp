import { validateNamingConventions } from '../src/namingConventions';

describe('naming conventions validation', () => {
  describe('name validation', () => {
    it('should pass valid camelCase name with verb', () => {
      const automation = {
        name: 'getData',
        description: 'Gets data',
        arguments: { id: { type: 'string' } },
        do: [],
      };
      const errors = validateNamingConventions(automation);
      const nameErrors = errors.filter((e) => e.params?.namingType === 'invalidNameFormat');
      expect(nameErrors.length).toBe(0);
    });

    it('should pass valid scoped name with verb', () => {
      const automation = {
        name: 'tools/files/summary/combineTexts',
        description: 'Combines texts',
        arguments: { texts: { type: 'array' } },
        do: [],
      };
      const errors = validateNamingConventions(automation);
      const nameErrors = errors.filter((e) => e.params?.namingType === 'invalidNameFormat');
      expect(nameErrors.length).toBe(0);
    });

    it('should pass valid name with onXxx pattern', () => {
      const automation = {
        name: 'forms/tools/onSubmit',
        description: 'Handles form submission',
        arguments: { formData: { type: 'object' } },
        do: [],
      };
      const errors = validateNamingConventions(automation);
      const nameErrors = errors.filter((e) => e.params?.namingType === 'invalidNameFormat');
      expect(nameErrors.length).toBe(0);
    });

    it('should pass valid name with onInit pattern', () => {
      const automation = {
        name: 'pages/dashboard/onInit',
        description: 'Initializes dashboard',
        arguments: {},
        do: [],
      };
      const errors = validateNamingConventions(automation);
      const nameErrors = errors.filter((e) => e.params?.namingType === 'invalidNameFormat');
      expect(nameErrors.length).toBe(0);
    });

    it('should fail name with underscore (not camelCase)', () => {
      const automation = {
        name: 'tools/my_bad_name',
        description: 'Bad name',
        arguments: {},
        do: [],
      };
      const errors = validateNamingConventions(automation);
      const nameErrors = errors.filter((e) => e.params?.namingType === 'invalidNameFormat');
      expect(nameErrors.length).toBeGreaterThan(0);
      expect(nameErrors[0].message).toContain('camelCase');
    });

    it('should fail name with hyphen (not camelCase)', () => {
      const automation = {
        name: 'tools/my-bad-name',
        description: 'Bad name',
        arguments: {},
        do: [],
      };
      const errors = validateNamingConventions(automation);
      const nameErrors = errors.filter((e) => e.params?.namingType === 'invalidNameFormat');
      expect(nameErrors.length).toBeGreaterThan(0);
    });

    it('should fail name not ending with verb or onXxx', () => {
      const automation = {
        name: 'tools/files/dataResult',
        description: 'Data result tool',
        arguments: {},
        do: [],
      };
      const errors = validateNamingConventions(automation);
      const nameErrors = errors.filter((e) => e.params?.namingType === 'invalidNameFormat');
      expect(nameErrors.length).toBeGreaterThan(0);
      expect(nameErrors[0].message).toContain('verb');
    });

    it('should fail name starting with uppercase (PascalCase)', () => {
      const automation = {
        name: 'Tools/GetData',
        description: 'Gets data',
        arguments: {},
        do: [],
      };
      const errors = validateNamingConventions(automation);
      const nameErrors = errors.filter((e) => e.params?.namingType === 'invalidNameFormat');
      expect(nameErrors.length).toBeGreaterThan(0);
    });

    it('should validate localized names', () => {
      const automation = {
        name: { en: 'tools/my_bad', fr: 'outils/getData' },
        description: 'Test',
        arguments: {},
        do: [],
      };
      const errors = validateNamingConventions(automation);
      const nameErrors = errors.filter((e) => e.params?.namingType === 'invalidNameFormat');
      // Should have error for 'en' name (underscore) but not 'fr' name
      expect(nameErrors.length).toBeGreaterThan(0);
      expect(nameErrors.some((e) => e.instancePath?.includes('/en'))).toBe(true);
    });
  });

  describe('slug validation', () => {
    it('should pass valid camelCase slug', () => {
      const automation = {
        name: 'getData',
        slug: 'getData',
        description: 'Gets data',
        arguments: {},
        do: [],
      };
      const errors = validateNamingConventions(automation);
      const slugErrors = errors.filter((e) => e.params?.namingType === 'invalidSlugFormat');
      expect(slugErrors.length).toBe(0);
    });

    it('should fail slug with slash (folder scoping)', () => {
      const automation = {
        name: 'tools/getData',
        slug: 'tools/getData',
        description: 'Gets data',
        arguments: {},
        do: [],
      };
      const errors = validateNamingConventions(automation);
      const slugErrors = errors.filter((e) => e.params?.namingType === 'invalidSlugFormat');
      expect(slugErrors.length).toBeGreaterThan(0);
      expect(slugErrors[0].message).toContain('should not contain');
    });

    it('should fail slug with underscore', () => {
      const automation = {
        name: 'getData',
        slug: 'get_data',
        description: 'Gets data',
        arguments: {},
        do: [],
      };
      const errors = validateNamingConventions(automation);
      const slugErrors = errors.filter((e) => e.params?.namingType === 'invalidSlugFormat');
      expect(slugErrors.length).toBeGreaterThan(0);
    });

    it('should fail slug with hyphen', () => {
      const automation = {
        name: 'getData',
        slug: 'get-data',
        description: 'Gets data',
        arguments: {},
        do: [],
      };
      const errors = validateNamingConventions(automation);
      const slugErrors = errors.filter((e) => e.params?.namingType === 'invalidSlugFormat');
      expect(slugErrors.length).toBeGreaterThan(0);
    });

    it('should fail slug starting with uppercase', () => {
      const automation = {
        name: 'getData',
        slug: 'GetData',
        description: 'Gets data',
        arguments: {},
        do: [],
      };
      const errors = validateNamingConventions(automation);
      const slugErrors = errors.filter((e) => e.params?.namingType === 'invalidSlugFormat');
      expect(slugErrors.length).toBeGreaterThan(0);
    });
  });

  describe('description validation', () => {
    it('should pass with valid description', () => {
      const automation = {
        name: 'getData',
        description: 'Fetches user data from the database',
        arguments: {},
        do: [],
      };
      const errors = validateNamingConventions(automation);
      const descErrors = errors.filter((e) => e.params?.namingType === 'missingDescription');
      expect(descErrors.length).toBe(0);
    });

    it('should fail without description', () => {
      const automation = {
        name: 'getData',
        arguments: {},
        do: [],
      };
      const errors = validateNamingConventions(automation);
      const descErrors = errors.filter((e) => e.params?.namingType === 'missingDescription');
      expect(descErrors.length).toBe(1);
    });

    it('should fail with empty description', () => {
      const automation = {
        name: 'getData',
        description: '',
        arguments: {},
        do: [],
      };
      const errors = validateNamingConventions(automation);
      const descErrors = errors.filter((e) => e.params?.namingType === 'missingDescription');
      expect(descErrors.length).toBe(1);
    });

    it('should fail with whitespace-only description', () => {
      const automation = {
        name: 'getData',
        description: '   ',
        arguments: {},
        do: [],
      };
      const errors = validateNamingConventions(automation);
      const descErrors = errors.filter((e) => e.params?.namingType === 'missingDescription');
      expect(descErrors.length).toBe(1);
    });

    it('should pass with localized description', () => {
      const automation = {
        name: 'getData',
        description: { en: 'Gets data', fr: 'Recupere les donnees' },
        arguments: {},
        do: [],
      };
      const errors = validateNamingConventions(automation);
      const descErrors = errors.filter((e) => e.params?.namingType === 'missingDescription');
      expect(descErrors.length).toBe(0);
    });

    it('should fail with empty localized description', () => {
      const automation = {
        name: 'getData',
        description: { en: '', fr: '' },
        arguments: {},
        do: [],
      };
      const errors = validateNamingConventions(automation);
      const descErrors = errors.filter((e) => e.params?.namingType === 'missingDescription');
      expect(descErrors.length).toBe(1);
    });
  });

  describe('arguments validation', () => {
    it('should pass with defined arguments', () => {
      const automation = {
        name: 'getData',
        description: 'Gets data',
        arguments: { userId: { type: 'string' } },
        do: [],
      };
      const errors = validateNamingConventions(automation);
      const argErrors = errors.filter((e) => e.params?.namingType === 'missingArguments');
      expect(argErrors.length).toBe(0);
    });

    it('should pass with empty arguments object', () => {
      const automation = {
        name: 'getData',
        description: 'Gets data',
        arguments: {},
        do: [],
      };
      const errors = validateNamingConventions(automation);
      const argErrors = errors.filter((e) => e.params?.namingType === 'missingArguments');
      expect(argErrors.length).toBe(0);
    });

    it('should fail without arguments', () => {
      const automation = {
        name: 'getData',
        description: 'Gets data',
        do: [],
      };
      const errors = validateNamingConventions(automation);
      const argErrors = errors.filter((e) => e.params?.namingType === 'missingArguments');
      expect(argErrors.length).toBe(1);
    });
  });

  describe('variable names in set instructions', () => {
    it('should pass camelCase variable names', () => {
      const automation = {
        name: 'getData',
        description: 'Gets data',
        arguments: {},
        do: [
          { set: { myVariable: 'test' } },
          { set: { anotherVar: 123 } },
        ],
      };
      const errors = validateNamingConventions(automation);
      const varErrors = errors.filter((e) => e.params?.namingType === 'invalidVariableName');
      expect(varErrors.length).toBe(0);
    });

    it('should fail variable names with underscores', () => {
      const automation = {
        name: 'getData',
        description: 'Gets data',
        arguments: {},
        do: [{ set: { my_variable: 'test' } }],
      };
      const errors = validateNamingConventions(automation);
      const varErrors = errors.filter((e) => e.params?.namingType === 'invalidVariableName');
      expect(varErrors.length).toBeGreaterThan(0);
      expect(varErrors[0].message).toContain('my_variable');
    });

    it('should fail variable names starting with uppercase', () => {
      const automation = {
        name: 'getData',
        description: 'Gets data',
        arguments: {},
        do: [{ set: { MyVariable: 'test' } }],
      };
      const errors = validateNamingConventions(automation);
      const varErrors = errors.filter((e) => e.params?.namingType === 'invalidVariableName');
      expect(varErrors.length).toBeGreaterThan(0);
    });

    it('should validate context variable names (user.xxx)', () => {
      const automation = {
        name: 'getData',
        description: 'Gets data',
        arguments: {},
        do: [
          { set: { 'user.myData': 'test' } },        // valid
          { set: { 'session.bad_name': 'test' } },  // invalid
        ],
      };
      const errors = validateNamingConventions(automation);
      const varErrors = errors.filter((e) => e.params?.namingType === 'invalidVariableName');
      expect(varErrors.length).toBe(1);
      expect(varErrors[0].message).toContain('bad_name');
    });

    it('should validate variables in nested instructions', () => {
      const automation = {
        name: 'getData',
        description: 'Gets data',
        arguments: {},
        do: [
          {
            conditions: {
              '{% true %}': [{ set: { bad_var: 'test' } }],
            },
          },
        ],
      };
      const errors = validateNamingConventions(automation);
      const varErrors = errors.filter((e) => e.params?.namingType === 'invalidVariableName');
      expect(varErrors.length).toBeGreaterThan(0);
    });

    it('should validate variables in repeat blocks', () => {
      const automation = {
        name: 'getData',
        description: 'Gets data',
        arguments: {},
        do: [
          {
            repeat: {
              on: '{{items}}',
              do: [{ set: { bad_item: '{{item}}' } }],
            },
          },
        ],
      };
      const errors = validateNamingConventions(automation);
      const varErrors = errors.filter((e) => e.params?.namingType === 'invalidVariableName');
      expect(varErrors.length).toBeGreaterThan(0);
    });
  });

  describe('event names in emit instructions', () => {
    it('should pass valid event name format', () => {
      const automation = {
        name: 'emitEvent',
        description: 'Emits an event',
        arguments: {},
        do: [{ emit: { event: 'Workspace.automations.updated' } }],
      };
      const errors = validateNamingConventions(automation);
      const eventErrors = errors.filter((e) => e.params?.namingType === 'invalidEventName');
      expect(eventErrors.length).toBe(0);
    });

    it('should pass two-part event name', () => {
      const automation = {
        name: 'emitEvent',
        description: 'Emits an event',
        arguments: {},
        do: [{ emit: { event: 'User.created' } }],
      };
      const errors = validateNamingConventions(automation);
      const eventErrors = errors.filter((e) => e.params?.namingType === 'invalidEventName');
      expect(eventErrors.length).toBe(0);
    });

    it('should fail event name without dot separator', () => {
      const automation = {
        name: 'emitEvent',
        description: 'Emits an event',
        arguments: {},
        do: [{ emit: { event: 'badEventName' } }],
      };
      const errors = validateNamingConventions(automation);
      const eventErrors = errors.filter((e) => e.params?.namingType === 'invalidEventName');
      expect(eventErrors.length).toBeGreaterThan(0);
    });

    it('should fail event name with lowercase namespace', () => {
      const automation = {
        name: 'emitEvent',
        description: 'Emits an event',
        arguments: {},
        do: [{ emit: { event: 'workspace.automations.updated' } }],
      };
      const errors = validateNamingConventions(automation);
      const eventErrors = errors.filter((e) => e.params?.namingType === 'invalidEventName');
      expect(eventErrors.length).toBeGreaterThan(0);
    });

    it('should fail event name with PascalCase action', () => {
      const automation = {
        name: 'emitEvent',
        description: 'Emits an event',
        arguments: {},
        do: [{ emit: { event: 'Workspace.Automations.Updated' } }],
      };
      const errors = validateNamingConventions(automation);
      const eventErrors = errors.filter((e) => e.params?.namingType === 'invalidEventName');
      expect(eventErrors.length).toBeGreaterThan(0);
    });

    it('should skip dynamic event names with expressions', () => {
      const automation = {
        name: 'emitEvent',
        description: 'Emits an event',
        arguments: {},
        do: [{ emit: { event: '{{eventType}}.triggered' } }],
      };
      const errors = validateNamingConventions(automation);
      const eventErrors = errors.filter((e) => e.params?.namingType === 'invalidEventName');
      expect(eventErrors.length).toBe(0);
    });

    it('should validate events in nested instructions', () => {
      const automation = {
        name: 'emitEvent',
        description: 'Emits an event',
        arguments: {},
        do: [
          {
            conditions: {
              '{% true %}': [{ emit: { event: 'badEvent' } }],
            },
          },
        ],
      };
      const errors = validateNamingConventions(automation);
      const eventErrors = errors.filter((e) => e.params?.namingType === 'invalidEventName');
      expect(eventErrors.length).toBeGreaterThan(0);
    });
  });

  describe('error object format', () => {
    it('should return Ajv-compatible ErrorObject shape', () => {
      const automation = {
        name: 'bad_name',
        do: [],
      };
      const errors = validateNamingConventions(automation);
      expect(errors.length).toBeGreaterThan(0);

      const error = errors[0];
      expect(error).toHaveProperty('keyword', 'naming');
      expect(error).toHaveProperty('instancePath');
      expect(error).toHaveProperty('schemaPath');
      expect(error).toHaveProperty('params');
      expect(error).toHaveProperty('message');
    });
  });

  describe('full automation validation', () => {
    it('should pass fully valid automation', () => {
      const automation = {
        name: 'tools/users/fetchData',
        slug: 'fetchUserData',
        description: 'Fetches user data from the API',
        arguments: {
          userId: { type: 'string', description: 'The user ID' },
        },
        do: [
          { set: { userData: null } },
          { emit: { event: 'User.data.requested' } },
        ],
      };
      const errors = validateNamingConventions(automation);
      expect(errors.length).toBe(0);
    });

    it('should catch multiple errors in invalid automation', () => {
      const automation = {
        name: 'bad_name/NotCamel',
        slug: 'tools/bad/slug',
        // missing description
        // missing arguments
        do: [
          { set: { bad_var: 'test' } },
          { emit: { event: 'badEvent' } },
        ],
      };
      const errors = validateNamingConventions(automation);

      // Should have errors for: name format, slug format, missing description,
      // missing arguments, variable name, event name
      expect(errors.length).toBeGreaterThanOrEqual(5);

      const errorTypes = errors.map((e) => e.params?.namingType);
      expect(errorTypes).toContain('invalidNameFormat');
      expect(errorTypes).toContain('invalidSlugFormat');
      expect(errorTypes).toContain('missingDescription');
      expect(errorTypes).toContain('missingArguments');
      expect(errorTypes).toContain('invalidVariableName');
      expect(errorTypes).toContain('invalidEventName');
    });
  });
});
