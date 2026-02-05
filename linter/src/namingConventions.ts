import type { ErrorObject } from 'ajv';
import { traverseInstructions } from './instructionTraversal.js';

/**
 * Types of naming convention errors
 */
export type NamingErrorType =
  | 'invalidSlugFormat'
  | 'invalidNameFormat'
  | 'missingDescription'
  | 'missingArguments'
  | 'invalidVariableName'
  | 'invalidEventName';

/**
 * Check if a string is in camelCase format.
 * Allows numbers but must start with lowercase letter.
 */
function isCamelCase(str: string): boolean {
  // camelCase: starts with lowercase, no spaces/underscores/hyphens at word boundaries
  // Allows: myVariable, myVar2, parseJSON, getHTTPResponse
  return /^[a-z][a-zA-Z0-9]*$/.test(str);
}

/**
 * Check if a string starts with a common verb (for automation names).
 */
function startsWithVerb(str: string): boolean {
  const commonVerbs = [
    'get', 'set', 'create', 'update', 'delete', 'remove', 'add', 'fetch',
    'load', 'save', 'send', 'receive', 'process', 'handle', 'validate',
    'check', 'verify', 'build', 'generate', 'parse', 'format', 'convert',
    'transform', 'map', 'filter', 'find', 'search', 'query', 'list',
    'init', 'initialize', 'reset', 'clear', 'refresh', 'sync', 'import',
    'export', 'upload', 'download', 'read', 'write', 'open', 'close',
    'start', 'stop', 'run', 'execute', 'trigger', 'emit', 'dispatch',
    'subscribe', 'unsubscribe', 'register', 'unregister', 'connect',
    'disconnect', 'authenticate', 'authorize', 'login', 'logout',
    'enable', 'disable', 'activate', 'deactivate', 'show', 'hide',
    'render', 'display', 'compute', 'calculate', 'count', 'sum',
    'merge', 'split', 'combine', 'extract', 'insert', 'append',
    'prepend', 'push', 'pop', 'shift', 'unshift', 'sort', 'reverse',
    'notify', 'alert', 'warn', 'log', 'track', 'record', 'measure',
    'test', 'mock', 'stub', 'spy', 'assert', 'expect', 'should',
    'can', 'is', 'has', 'does', 'will', 'would', 'could', 'may',
  ];

  const lowerStr = str.toLowerCase();
  return commonVerbs.some(verb => lowerStr.startsWith(verb));
}

/**
 * Check if a string starts with "on" (event handler pattern).
 */
function startsWithOn(str: string): boolean {
  return /^on[A-Z]/.test(str);
}

/**
 * Check if event name follows the convention: Namespace.entity.action
 * e.g., Workspace.automations.updated, Ingestion.crawl.failed
 */
function isValidEventName(eventName: string): boolean {
  // Event names should be PascalCase.camelCase.camelCase (dot-separated)
  const parts = eventName.split('.');
  if (parts.length < 2) {
    return false;
  }

  // First part should be PascalCase (namespace)
  const isPascalCase = (s: string) => /^[A-Z][a-zA-Z0-9]*$/.test(s);
  // Other parts should be camelCase
  const isCamelCaseOrLower = (s: string) => /^[a-z][a-zA-Z0-9]*$/.test(s);

  if (!isPascalCase(parts[0])) {
    return false;
  }

  for (let i = 1; i < parts.length; i++) {
    if (!isCamelCaseOrLower(parts[i])) {
      return false;
    }
  }

  return true;
}

/**
 * Create a naming convention error in Ajv ErrorObject format.
 */
function createError(
  path: string,
  errorType: NamingErrorType,
  message: string,
  value?: string
): ErrorObject {
  return {
    keyword: 'naming',
    instancePath: path,
    schemaPath: `#/naming/${errorType}`,
    params: {
      namingType: errorType,
      ...(value !== undefined && { value }),
    },
    message,
  } as ErrorObject;
}

/**
 * Validate automation name format.
 * Name can have folder scope with `/`, each segment should be camelCase,
 * and the last segment should be a verb or start with "on".
 */
function validateName(
  automation: Record<string, unknown>,
  errors: ErrorObject[]
): void {
  const name = automation.name;

  if (!name) {
    return; // Schema validation handles required fields
  }

  // Handle localized names (object with language keys)
  if (typeof name === 'object' && name !== null) {
    const localizedName = name as Record<string, string>;
    // Validate each localized name
    for (const [lang, localName] of Object.entries(localizedName)) {
      if (typeof localName === 'string') {
        validateNameString(localName, `/name/${lang}`, errors);
      }
    }
    return;
  }

  if (typeof name === 'string') {
    validateNameString(name, '/name', errors);
  }
}

/**
 * Validate a single name string.
 */
function validateNameString(
  name: string,
  path: string,
  errors: ErrorObject[]
): void {
  const segments = name.split('/');

  // Check each segment is camelCase
  for (let i = 0; i < segments.length; i++) {
    const segment = segments[i];
    if (!segment) continue; // Skip empty segments (e.g., leading slash)

    if (!isCamelCase(segment)) {
      errors.push(
        createError(
          path,
          'invalidNameFormat',
          `Name segment '${segment}' should be camelCase`,
          name
        )
      );
    }
  }

  // Check last segment is a verb or starts with "on"
  const lastSegment = segments[segments.length - 1];
  if (lastSegment && !startsWithVerb(lastSegment) && !startsWithOn(lastSegment)) {
    errors.push(
      createError(
        path,
        'invalidNameFormat',
        `Automation name should end with a verb (e.g., 'getData') or event handler pattern (e.g., 'onSubmit'). Found: '${lastSegment}'`,
        name
      )
    );
  }
}

/**
 * Validate slug format (camelCase only, no folder scoping).
 */
function validateSlug(
  automation: Record<string, unknown>,
  errors: ErrorObject[]
): void {
  const slug = automation.slug;

  if (!slug || typeof slug !== 'string') {
    return; // Slug is optional
  }

  // Slug should not contain /
  if (slug.includes('/')) {
    errors.push(
      createError(
        '/slug',
        'invalidSlugFormat',
        `Slug should not contain '/' - use name for folder scoping. Found: '${slug}'`,
        slug
      )
    );
    return;
  }

  // Slug should be camelCase
  if (!isCamelCase(slug)) {
    errors.push(
      createError(
        '/slug',
        'invalidSlugFormat',
        `Slug '${slug}' should be camelCase`,
        slug
      )
    );
  }
}

/**
 * Validate that description is present.
 */
function validateDescription(
  automation: Record<string, unknown>,
  errors: ErrorObject[]
): void {
  const description = automation.description;

  if (!description) {
    errors.push(
      createError(
        '/description',
        'missingDescription',
        'Automation should have a description'
      )
    );
    return;
  }

  // Handle localized descriptions
  if (typeof description === 'object' && description !== null) {
    const localizedDesc = description as Record<string, string>;
    const hasContent = Object.values(localizedDesc).some(
      v => typeof v === 'string' && v.trim().length > 0
    );
    if (!hasContent) {
      errors.push(
        createError(
          '/description',
          'missingDescription',
          'Automation should have a non-empty description'
        )
      );
    }
    return;
  }

  if (typeof description === 'string' && description.trim().length === 0) {
    errors.push(
      createError(
        '/description',
        'missingDescription',
        'Automation should have a non-empty description'
      )
    );
  }
}

/**
 * Validate that arguments are defined with typing.
 */
function validateArguments(
  automation: Record<string, unknown>,
  errors: ErrorObject[]
): void {
  const args = automation.arguments;

  if (!args) {
    errors.push(
      createError(
        '/arguments',
        'missingArguments',
        'Automation should define its arguments schema'
      )
    );
    return;
  }

  if (typeof args !== 'object' || args === null) {
    errors.push(
      createError(
        '/arguments',
        'missingArguments',
        'Arguments should be an object defining the schema'
      )
    );
  }
}

/**
 * Validate variable names in set instructions.
 */
function validateVariableNames(
  automation: Record<string, unknown>,
  errors: ErrorObject[]
): void {
  traverseInstructions(automation as { do?: unknown[] }, (instruction, path) => {
    // Check set instruction
    if ('set' in instruction && typeof instruction.set === 'object' && instruction.set !== null) {
      const setObj = instruction.set as Record<string, unknown>;

      for (const varName of Object.keys(setObj)) {
        // Skip context paths like user.xxx, session.xxx, global.xxx, run.xxx
        if (/^(user|session|global|run|socket)\./.test(varName)) {
          // Extract the variable name after the context prefix
          const parts = varName.split('.');
          for (let i = 1; i < parts.length; i++) {
            const part = parts[i];
            // Skip array access patterns like [0] or dynamic access
            if (part.includes('[') || part.includes('{')) continue;
            if (!isCamelCase(part)) {
              errors.push(
                createError(
                  `${path}.set`,
                  'invalidVariableName',
                  `Variable name '${part}' in '${varName}' should be camelCase`,
                  varName
                )
              );
            }
          }
          continue;
        }

        // Regular variable names should be camelCase
        if (!isCamelCase(varName) && !varName.includes('.') && !varName.includes('[')) {
          errors.push(
            createError(
              `${path}.set`,
              'invalidVariableName',
              `Variable name '${varName}' should be camelCase`,
              varName
            )
          );
        }
      }
    }
  });
}

/**
 * Validate event names in emit instructions.
 */
function validateEmitEventNames(
  automation: Record<string, unknown>,
  errors: ErrorObject[]
): void {
  traverseInstructions(automation as { do?: unknown[] }, (instruction, path) => {
    // Check emit instruction
    if ('emit' in instruction && typeof instruction.emit === 'object' && instruction.emit !== null) {
      const emitObj = instruction.emit as Record<string, unknown>;
      const eventName = emitObj.event;

      if (typeof eventName === 'string') {
        // Skip dynamic event names (containing expressions)
        if (eventName.includes('{{') || eventName.includes('{%')) {
          return;
        }

        if (!isValidEventName(eventName)) {
          errors.push(
            createError(
              `${path}.emit.event`,
              'invalidEventName',
              `Event name '${eventName}' should follow format 'Namespace.entity.action' (e.g., 'Workspace.automations.updated')`,
              eventName
            )
          );
        }
      }
    }
  });
}

/**
 * Validate all naming conventions in an automation.
 *
 * Checks:
 * - name: camelCase segments, last segment is verb or starts with "on"
 * - slug: camelCase only, no folder scoping
 * - description: must be present
 * - arguments: must be defined
 * - variable names in set instructions: camelCase
 * - event names in emit instructions: Namespace.entity.action format
 *
 * @param automation - The automation object to validate
 * @returns Array of errors found (empty if valid)
 */
export function validateNamingConventions(automation: unknown): ErrorObject[] {
  const errors: ErrorObject[] = [];

  if (!automation || typeof automation !== 'object') {
    return errors;
  }

  const auto = automation as Record<string, unknown>;

  validateName(auto, errors);
  validateSlug(auto, errors);
  validateDescription(auto, errors);
  validateArguments(auto, errors);
  validateVariableNames(auto, errors);
  validateEmitEventNames(auto, errors);

  return errors;
}
