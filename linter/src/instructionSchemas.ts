/**
 * JSON Schemas for instructions not defined in @prisme.ai/validation/instructions.json
 * These supplement the built-in schemas to provide complete coverage.
 *
 * Schema structure follows the same pattern as instructions.json:
 * - Top-level object with instruction name as required property
 * - maxProperties: 1 ensures only the instruction key is present
 * - Nested object defines the instruction's arguments
 */
export const SUPPLEMENTARY_SCHEMAS: Record<string, object> = {
  try: {
    type: 'object',
    required: ['try'],
    maxProperties: 1,
    properties: {
      try: {
        type: 'object',
        required: ['do'],
        properties: {
          do: {
            type: 'array',
            description: 'Instructions to attempt',
          },
          catch: {
            type: 'array',
            description: 'Instructions to run if an error occurs',
          },
          finally: {
            type: 'array',
            description: 'Instructions to run regardless of success/failure',
          },
        },
        additionalProperties: false,
      },
    },
  },

  createUserTopic: {
    type: 'object',
    required: ['createUserTopic'],
    maxProperties: 1,
    properties: {
      createUserTopic: {
        type: 'object',
        properties: {
          topic: {
            type: 'string',
            description: 'Topic name',
          },
          userTopic: {
            type: 'string',
            description: 'Alternative: user topic name',
          },
          userIds: {
            type: 'array',
            items: { type: 'string' },
            description: 'List of user IDs to add to the topic',
          },
        },
        additionalProperties: false,
      },
    },
  },

  joinUserTopic: {
    type: 'object',
    required: ['joinUserTopic'],
    maxProperties: 1,
    properties: {
      joinUserTopic: {
        type: 'object',
        properties: {
          topic: {
            type: 'string',
            description: 'Topic name',
          },
          userTopic: {
            type: 'string',
            description: 'Alternative: user topic name',
          },
          userIds: {
            type: 'array',
            items: { type: 'string' },
            description: 'List of user IDs to join the topic',
          },
        },
        additionalProperties: false,
      },
    },
  },

  auth: {
    type: 'object',
    required: ['auth'],
    maxProperties: 1,
    properties: {
      auth: {
        type: 'object',
        properties: {
          workspace: {
            type: 'boolean',
            description: 'Authenticate with workspace context',
          },
          service: {
            type: 'string',
            description: 'Service to authenticate with',
          },
          with: {
            type: 'object',
            description: 'Authentication parameters',
            additionalProperties: true,
          },
          output: {
            type: 'string',
            description: 'Variable name to store authentication result',
          },
        },
        additionalProperties: false,
      },
    },
  },
};

/**
 * List of instruction types that have supplementary schemas
 */
export const SUPPLEMENTARY_INSTRUCTION_TYPES = Object.keys(SUPPLEMENTARY_SCHEMAS);
