import {
  dealCreateSchema,
  dealMoveSchema,
  dealSchema,
  dealSummarySchema,
  dealUpdateSchema,
  errorSchema,
  healthLiveSchema,
  healthStatusSchema,
  listMetaSchema,
  pipelineWithStagesSchema,
} from '@lulu/shared';
import { z, type ZodType } from 'zod';
import {
  
} from '@lulu/shared';


export type JsonObject = Record<string, unknown>;

const COMPONENT_NAMES = {
  HealthStatus: healthStatusSchema,
  HealthLiveStatus: healthLiveSchema,
  ListMeta: listMetaSchema,
  ErrorEnvelope: errorSchema,
  Deal: dealSchema,
  DealCreate: dealCreateSchema,
  DealUpdate: dealUpdateSchema,
  DealMove: dealMoveSchema,
  DealSummary: dealSummarySchema,
  PipelineWithStages: pipelineWithStagesSchema,
} as const satisfies Record<string, ZodType>;

export type ComponentName = keyof typeof COMPONENT_NAMES;

export const COMPONENT_REF_PREFIX = '#/components/schemas/';

export function schemaRef(name: ComponentName): string {
  return `${COMPONENT_REF_PREFIX}${name}`;
}

// Zod 4 emits draft 2020-12 JSON Schema, which OpenAPI 3.1 embeds directly.
export function toJsonSchema(schema: ZodType): JsonObject {
  const json = z.toJSONSchema(schema, {
    io: 'output',
    unrepresentable: 'any',
    target: 'draft-2020-12',
  }) as JsonObject;
  // $schema belongs on standalone JSON Schema documents, not on OpenAPI components.
  delete json.$schema;
  return json;
}

// Single source of component schemas: every entry is a Zod schema from packages/shared.
export function buildComponentSchemas(): Record<ComponentName, JsonObject> {
  return Object.fromEntries(
    Object.entries(COMPONENT_NAMES).map(([name, schema]) => [name, toJsonSchema(schema)]),
  ) as Record<ComponentName, JsonObject>;
}
