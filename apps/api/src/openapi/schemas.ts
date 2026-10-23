import {
  auditEntrySchema,
  aiAcceptSchema,
  aiInsightSchema,
  aiRunSchema,
  aiSettingsSchema,
  segmentCreateSchema,
  segmentListItemSchema,
  segmentSchema,
  segmentUpdateSchema,
  consentSettingsSchema,
  customFieldCreateSchema,
  customFieldSchema,
  customFieldUpdateSchema,
  notificationSettingsSchema,
  overviewSchema,
  rolePermissionsSchema,
  stageCreateSchema,
  stageSchema,
  stageUpdateSchema,
  heldRowSchema,
  importConfirmSchema,
  importJobSchema,
  importMappingInputSchema,
  importPreviewSchema,
  importResolveSchema,
  authSessionSchema,
  companyCreateSchema,
  companyDetailSchema,
  companyListItemSchema,
  companyUpdateSchema,
  contactCreateSchema,
  contactSchema,
  contactUpdateSchema,
  dealCreateSchema,
  dealMoveSchema,
  dealSchema,
  dealSummarySchema,
  dealUpdateSchema,
  errorSchema,
  healthLiveSchema,
  healthStatusSchema,
  listMetaSchema,
  loginInputSchema,
  meUpdateSchema,
  pipelineWithStagesSchema,
  timelineItemSchema,
  userSchema,
  activityCreateSchema,
  activitySchema,
  moduleEventSchema,
  noteCreateSchema,
  noteSchema,
  noteUpdateSchema,
  taskCreateSchema,
  taskSchema,
  taskUpdateSchema,
} from '@lulu/shared';
import { z, type ZodType } from 'zod';

export type JsonObject = Record<string, unknown>;

// Scheme name for the bearer token from POST /auth/login. Lives here (not in
// document.ts) so paths.ts can reference it without a circular import.
export const BEARER_AUTH_SCHEME = 'bearerAuth';

const COMPONENT_NAMES = {
  HealthStatus: healthStatusSchema,
  HealthLiveStatus: healthLiveSchema,
  ListMeta: listMetaSchema,
  AuditEntry: auditEntrySchema,
  ErrorEnvelope: errorSchema,
  LoginInput: loginInputSchema,
  AuthSession: authSessionSchema,
  MeUpdateInput: meUpdateSchema,
  User: userSchema,
  Deal: dealSchema,
  DealCreate: dealCreateSchema,
  DealUpdate: dealUpdateSchema,
  DealMove: dealMoveSchema,
  DealSummary: dealSummarySchema,
  PipelineWithStages: pipelineWithStagesSchema,
  Contact: contactSchema,
  ContactCreate: contactCreateSchema,
  ContactUpdate: contactUpdateSchema,
  Company: companyListItemSchema,
  CompanyCreate: companyCreateSchema,
  CompanyUpdate: companyUpdateSchema,
  CompanyDetail: companyDetailSchema,
  TimelineItem: timelineItemSchema,
  AiInsight: aiInsightSchema,
  AiRun: aiRunSchema,
  AiAccept: aiAcceptSchema,
  ImportJob: importJobSchema,
  ImportMappingInput: importMappingInputSchema,
  ImportPreview: importPreviewSchema,
  ImportConfirm: importConfirmSchema,
  HeldRow: heldRowSchema,
  ImportResolve: importResolveSchema,
  CustomField: customFieldSchema,
  CustomFieldCreate: customFieldCreateSchema,
  CustomFieldUpdate: customFieldUpdateSchema,
  Stage: stageSchema,
  StageCreate: stageCreateSchema,
  StageUpdate: stageUpdateSchema,
  RolePermissions: rolePermissionsSchema,
  ConsentSettings: consentSettingsSchema,
  NotificationSettings: notificationSettingsSchema,
  AiSettings: aiSettingsSchema,
  Overview: overviewSchema,
  Segment: segmentSchema,
  SegmentListItem: segmentListItemSchema,
  SegmentCreate: segmentCreateSchema,
  SegmentUpdate: segmentUpdateSchema,
  Task: taskSchema,
  TaskCreate: taskCreateSchema,
  TaskUpdate: taskUpdateSchema,
  Note: noteSchema,
  NoteCreate: noteCreateSchema,
  NoteUpdate: noteUpdateSchema,
  Activity: activitySchema,
  ActivityCreate: activityCreateSchema,
  ModuleEvent: moduleEventSchema,
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
