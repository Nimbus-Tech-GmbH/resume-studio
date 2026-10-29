import { z } from 'zod';
import { jsonSchema } from 'ai';
import { CHANGE_TYPES } from './types';

const changeSchema = z
  .object({
    id: z.string().min(1),
    group: z.string().min(1),
    type: z.enum(CHANGE_TYPES),
    section: z.string().min(1),
    entity: z.string().min(1),
    summary: z.string().min(1),
    path: z.string().startsWith('/'),
    op: z.enum(['rewrite', 'reorder', 'delete', 'narrow']),
    before: z.unknown(),
    after: z.unknown(),
    evidence: z.array(z.string().startsWith('/')),
  })
  .strict();

const gapSchema = z
  .object({
    id: z.string().min(1),
    requirement: z.string().min(1),
    explanation: z.string().min(1),
    reason: z.string().min(1),
  })
  .strict();

/**
 * The exact top-level contract. `.strict()` rejects extra keys; all keys are
 * required, so a missing key fails closed as well.
 */
export const TailoringResponseSchema = z
  .object({
    resume: z.record(z.unknown()),
    changes: z.array(changeSchema),
    gaps: z.array(gapSchema),
  })
  .strict();

export type ParsedTailoringResponse = z.infer<typeof TailoringResponseSchema>;

/**
 * Generation-only JSON Schema. Ollama's structured-output converter rejects
 * some JSON Schema constructs produced from Zod (for example optional `{}`
 * properties). This schema keeps every property required and uses an open
 * object for the resume and before/after values. The Zod schema above remains
 * the strict validation gate after generation.
 */
export const TailoringGenerationSchema = jsonSchema<{
  resume: Record<string, unknown>;
  changes: Array<Record<string, unknown>>;
  gaps: Array<Record<string, unknown>>;
}>({
  type: 'object',
  properties: {
    // Keep the generation grammar shallow. The strict Zod schema below
    // validates every nested field after generation. A shallow envelope is
    // fast in Ollama and still prevents a bare resume object at the root.
    resume: { type: 'object', additionalProperties: true },
    changes: {
      type: 'array',
      items: { type: 'object', additionalProperties: true },
    },
    gaps: {
      type: 'array',
      items: { type: 'object', additionalProperties: true },
    },
  },
  required: ['resume', 'changes', 'gaps'],
  additionalProperties: false,
});

export { changeSchema, gapSchema };
