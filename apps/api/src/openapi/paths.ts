import { BEARER_AUTH_SCHEME, schemaRef, type ComponentName } from './schemas';

// Authenticated operations carry the bearer token from POST /auth/login.
// Every /api/v1 route except POST /auth/login sits behind requireAuth
// (routes/index.ts), so the default is authenticated and only the
// unauthenticated operations opt out with security: [].
const bearer: Array<Record<string, string[]>> = [{ [BEARER_AUTH_SCHEME]: [] }];

export interface OpenApiOperation {
  operationId: string;
  summary: string;
  description: string;
  tags: string[];
  security?: Array<Record<string, string[]>>;
  responses: Record<string, unknown>;
  parameters?: unknown[];
  requestBody?: unknown;
}

export type OpenApiPaths = Record<
  string,
  Partial<Record<'get' | 'post' | 'put' | 'patch' | 'delete', OpenApiOperation>>
>;

const idParam = { name: 'id', in: 'path', required: true, schema: { type: 'string' } };

const listParams = [
  ['q', 'string'],
  ['sort', 'string'],
  ['page', 'integer'],
  ['pageSize', 'integer'],
  ['stageId', 'string'],
  ['ownerId', 'string'],
  ['companyId', 'string'],
  ['contactId', 'string'],
  ['status', 'string'],
].map(([name, type]) => ({ name, in: 'query', required: false, schema: { type } }));

const contactListParams = [
  ['q', 'string'],
  ['sort', 'string'],
  ['page', 'integer'],
  ['pageSize', 'integer'],
  ['stage', 'string'],
  ['ownerId', 'string'],
  ['companyId', 'string'],
  ['tag', 'string'],
  ['needsFollowUp', 'boolean'],
  ['createdSince', 'string'],
  ['segmentId', 'string'],
].map(([name, type]) => ({ name, in: 'query', required: false, schema: { type } }));

const companyListParams = [
  ['q', 'string'],
  ['sort', 'string'],
  ['page', 'integer'],
  ['pageSize', 'integer'],
  ['ownerId', 'string'],
  ['industry', 'string'],
  ['health', 'string'],
].map(([name, type]) => ({ name, in: 'query', required: false, schema: { type } }));

const errorResponse = (description: string) => ({
  description,
  content: { 'application/json': { schema: { $ref: schemaRef('ErrorEnvelope') } } },
});

const dataResponse = (description: string, name: ComponentName) => ({
  description,
  content: {
    'application/json': {
      schema: {
        type: 'object',
        required: ['data'],
        properties: { data: { $ref: schemaRef(name) } },
      },
    },
  },
});

const jsonBody = (name: ComponentName) => ({
  required: true,
  content: { 'application/json': { schema: { $ref: schemaRef(name) } } },
});

const listDataResponse = (description: string, name: ComponentName) => ({
  description,
  content: {
    'application/json': {
      schema: {
        type: 'object',
        required: ['data', 'meta'],
        properties: {
          data: { type: 'array', items: { $ref: schemaRef(name) } },
          meta: { $ref: schemaRef('ListMeta') },
        },
      },
    },
  },
});

const dealPaths: OpenApiPaths = {
  '/api/v1/pipelines': {
    get: {
      operationId: 'listPipelines',
      security: bearer,
      summary: 'List pipelines with their stages',
      description: 'Pipelines of the current workspace, each with its stages in order.',
      tags: ['Deals'],
      responses: {
        '200': {
          description: 'Pipelines with stages.',
          content: {
            'application/json': {
              schema: {
                type: 'object',
                required: ['data'],
                properties: {
                  data: { type: 'array', items: { $ref: schemaRef('PipelineWithStages') } },
                },
              },
            },
          },
        },
        '401': errorResponse('Not authenticated.'),
      },
    },
  },
  '/api/v1/deals': {
    get: {
      operationId: 'listDeals',
      summary: 'List deals',
      security: bearer,
      description: 'Filters: stageId, ownerId, companyId, contactId, status (open, won, lost).',
      tags: ['Deals'],
      parameters: listParams,
      responses: {
        '200': {
          description: 'A page of deals.',
          content: {
            'application/json': {
              schema: {
                type: 'object',
                required: ['data', 'meta'],
                properties: {
                  data: { type: 'array', items: { $ref: schemaRef('Deal') } },
                  meta: { $ref: schemaRef('ListMeta') },
                },
              },
            },
          },
        },
        '400': errorResponse('Invalid query.'),
        '401': errorResponse('Not authenticated.'),
      },
    },
    post: {
      operationId: 'createDeal',
      summary: 'Create a deal',
      security: bearer,
      description:
        'Currency defaults to the workspace currency, probability to the stage, owner to the current user.',
      tags: ['Deals'],
      requestBody: jsonBody('DealCreate'),
      responses: {
        '201': dataResponse('The created deal.', 'Deal'),
        '400': errorResponse('Invalid body.'),
        '401': errorResponse('Not authenticated.'),
        '404': errorResponse('STAGE_NOT_FOUND.'),
      },
    },
  },
  '/api/v1/deals/summary': {
    get: {
      operationId: 'getDealSummary',
      summary: 'Deal summary',
      security: bearer,
      description:
        'Open value, weighted value, win rate, active deals and average days to close, computed on the server. Optional pipelineId, default pipeline otherwise.',
      tags: ['Deals'],
      parameters: [
        { name: 'pipelineId', in: 'query', required: false, schema: { type: 'string' } },
      ],
      responses: {
        '200': dataResponse('The summary.', 'DealSummary'),
        '401': errorResponse('Not authenticated.'),
        '404': errorResponse('Pipeline not found.'),
      },
    },
  },
  '/api/v1/deals/{id}': {
    get: {
      operationId: 'getDeal',
      summary: 'Get a deal',
      security: bearer,
      description: 'One deal of the current workspace.',
      tags: ['Deals'],
      parameters: [idParam],
      responses: {
        '200': dataResponse('The deal.', 'Deal'),
        '401': errorResponse('Not authenticated.'),
        '404': errorResponse('Deal not found.'),
      },
    },
    patch: {
      operationId: 'updateDeal',
      summary: 'Edit a deal',
      security: bearer,
      description: 'The stage cannot be changed here: use POST /deals/{id}/move.',
      tags: ['Deals'],
      parameters: [idParam],
      requestBody: jsonBody('DealUpdate'),
      responses: {
        '200': dataResponse('The updated deal.', 'Deal'),
        '400': errorResponse('Invalid body, including a stageId.'),
        '401': errorResponse('Not authenticated.'),
        '404': errorResponse('Deal not found.'),
      },
    },
    delete: {
      operationId: 'deleteDeal',
      summary: 'Delete a deal',
      security: bearer,
      description: 'Soft delete.',
      tags: ['Deals'],
      parameters: [idParam],
      responses: {
        '204': { description: 'Deleted.' },
        '401': errorResponse('Not authenticated.'),
        '403': errorResponse('FORBIDDEN: the role may not delete deals.'),
        '404': errorResponse('Deal not found.'),
      },
    },
  },
  '/api/v1/deals/{id}/move': {
    post: {
      operationId: 'moveDeal',
      summary: 'Move a deal to another stage',
      security: bearer,
      description:
        'Updates probability and closedAt, and logs a stage_changed activity. Errors: STAGE_NOT_FOUND (404), STAGE_IN_OTHER_PIPELINE (400).',
      tags: ['Deals'],
      parameters: [idParam],
      requestBody: jsonBody('DealMove'),
      responses: {
        '200': dataResponse('The moved deal.', 'Deal'),
        '400': errorResponse('STAGE_IN_OTHER_PIPELINE or invalid body.'),
        '401': errorResponse('Not authenticated.'),
        '404': errorResponse('Deal or STAGE_NOT_FOUND.'),
      },
    },
  },
};

const contactsPaths: OpenApiPaths = {
  '/api/v1/contacts': {
    get: {
      operationId: 'listContacts',
      summary: 'List contacts',
      security: bearer,
      description:
        'Filters: stage, ownerId, companyId, tag, needsFollowUp, createdSince, segmentId. q searches name, email, company name and tags. sort defaults to -lastTouchAt.',
      tags: ['Contacts'],
      parameters: contactListParams,
      responses: {
        '200': listDataResponse('A page of contacts.', 'Contact'),
        '400': errorResponse('Invalid query, including an unsupported sort.'),
        '401': errorResponse('Not authenticated.'),
      },
    },
    post: {
      operationId: 'createContact',
      summary: 'Create a contact',
      security: bearer,
      description:
        'Owner defaults to the current user, lifecycleStage to new. An email another contact already has (ignoring case) answers 409 DUPLICATE_CONTACT.',
      tags: ['Contacts'],
      requestBody: jsonBody('ContactCreate'),
      responses: {
        '201': dataResponse('The created contact.', 'Contact'),
        '400': errorResponse('Invalid body or an unknown company/owner.'),
        '401': errorResponse('Not authenticated.'),
        '409': errorResponse('DUPLICATE_CONTACT.'),
      },
    },
  },
  '/api/v1/contacts/{id}': {
    get: {
      operationId: 'getContact',
      summary: 'Get a contact',
      security: bearer,
      description: 'The contact plus its linked company (or null). Counts are not returned yet.',
      tags: ['Contacts'],
      parameters: [idParam],
      responses: {
        '200': dataResponse('The contact.', 'Contact'),
        '401': errorResponse('Not authenticated.'),
        '404': errorResponse('CONTACT_NOT_FOUND.'),
      },
    },
    patch: {
      operationId: 'updateContact',
      summary: 'Edit a contact',
      security: bearer,
      description: 'Partial update. Duplicate email or name+company answers 409 DUPLICATE_CONTACT.',
      tags: ['Contacts'],
      parameters: [idParam],
      requestBody: jsonBody('ContactUpdate'),
      responses: {
        '200': dataResponse('The updated contact.', 'Contact'),
        '400': errorResponse('Invalid body.'),
        '401': errorResponse('Not authenticated.'),
        '404': errorResponse('CONTACT_NOT_FOUND.'),
        '409': errorResponse('DUPLICATE_CONTACT.'),
      },
    },
    delete: {
      operationId: 'deleteContact',
      summary: 'Delete a contact',
      security: bearer,
      description: 'Soft delete.',
      tags: ['Contacts'],
      parameters: [idParam],
      responses: {
        '204': { description: 'Deleted.' },
        '401': errorResponse('Not authenticated.'),
        '403': errorResponse('FORBIDDEN: the role may not delete contacts.'),
        '404': errorResponse('CONTACT_NOT_FOUND.'),
      },
    },
  },
  '/api/v1/contacts/{id}/convert': {
    post: {
      operationId: 'convertContact',
      summary: 'Convert a lead to a customer',
      security: bearer,
      description:
        'Sets lifecycleStage to customer and logs a stage_changed activity. Takes no body.',
      tags: ['Contacts'],
      parameters: [idParam],
      responses: {
        '200': dataResponse('The converted contact.', 'Contact'),
        '401': errorResponse('Not authenticated.'),
        '404': errorResponse('CONTACT_NOT_FOUND.'),
      },
    },
  },
  '/api/v1/contacts/{id}/timeline': {
    get: {
      operationId: 'getContactTimeline',
      summary: 'Contact timeline',
      security: bearer,
      description:
        'Activities, notes and open tasks for this contact, newest first by `at`. Private notes are only returned to their author.',
      tags: ['Contacts'],
      parameters: [idParam],
      responses: {
        '200': {
          description: 'Timeline items (activities, notes, tasks).',
          content: {
            'application/json': {
              schema: {
                type: 'object',
                required: ['data'],
                properties: {
                  data: { type: 'array', items: { $ref: schemaRef('TimelineItem') } },
                },
              },
            },
          },
        },
        '401': errorResponse('Not authenticated.'),
        '404': errorResponse('CONTACT_NOT_FOUND.'),
      },
    },
  },
};

const companiesPaths: OpenApiPaths = {
  '/api/v1/companies': {
    get: {
      operationId: 'listCompanies',
      summary: 'List companies',
      security: bearer,
      description:
        'Each company with its contact count and open deal value. Filters: ownerId, industry, health. q searches name, domain and industry. sort: name, contactCount, openDealValue or lastTouchAt, default -openDealValue.',
      tags: ['Companies'],
      parameters: companyListParams,
      responses: {
        '200': listDataResponse('A page of companies with computed numbers.', 'Company'),
        '400': errorResponse('Invalid query, including an unsupported sort.'),
        '401': errorResponse('Not authenticated.'),
      },
    },
    post: {
      operationId: 'createCompany',
      summary: 'Create a company',
      security: bearer,
      description:
        'Owner defaults to the current user. domain is a bare lower-case host. Returns the computed list-item shape.',
      tags: ['Companies'],
      requestBody: jsonBody('CompanyCreate'),
      responses: {
        '201': dataResponse('The created company.', 'Company'),
        '400': errorResponse('Invalid body or an unknown owner.'),
        '401': errorResponse('Not authenticated.'),
      },
    },
  },
  '/api/v1/companies/{id}': {
    get: {
      operationId: 'getCompany',
      summary: 'Get a company',
      security: bearer,
      description:
        'The company with its people (most recent touch first) and deals, plus the computed numbers.',
      tags: ['Companies'],
      parameters: [idParam],
      responses: {
        '200': dataResponse('The company detail.', 'CompanyDetail'),
        '401': errorResponse('Not authenticated.'),
        '404': errorResponse('COMPANY_NOT_FOUND.'),
      },
    },
    patch: {
      operationId: 'updateCompany',
      summary: 'Edit a company',
      security: bearer,
      description: 'Partial update. Returns the computed list-item shape.',
      tags: ['Companies'],
      parameters: [idParam],
      requestBody: jsonBody('CompanyUpdate'),
      responses: {
        '200': dataResponse('The updated company.', 'Company'),
        '400': errorResponse('Invalid body.'),
        '401': errorResponse('Not authenticated.'),
        '404': errorResponse('COMPANY_NOT_FOUND.'),
      },
    },
    delete: {
      operationId: 'deleteCompany',
      summary: 'Delete a company',
      security: bearer,
      description: 'Soft delete. Its contacts and deals keep their link.',
      tags: ['Companies'],
      parameters: [idParam],
      responses: {
        '204': { description: 'Deleted.' },
        '401': errorResponse('Not authenticated.'),
        '403': errorResponse('FORBIDDEN: the role may not delete companies.'),
        '404': errorResponse('COMPANY_NOT_FOUND.'),
      },
    },
  },
};

const authPaths: OpenApiPaths = {
  '/api/v1/auth/login': {
    post: {
      operationId: 'login',
      summary: 'Log in',
      description:
        'Email and password. Returns a bearer token; the workspace is read from the token, never the body. A wrong password and an unknown email both answer 401 UNAUTHORIZED, so the response never says which part was wrong. Unauthenticated.',
      tags: ['Auth'],
      security: [],
      requestBody: jsonBody('LoginInput'),
      responses: {
        '200': {
          description: 'Logged in.',
          content: {
            'application/json': {
              schema: { type: 'object', properties: { data: { $ref: schemaRef('AuthSession') } } },
              example: { data: { token: '<jwt>', expiresAt: '2026-10-19T12:00:00.000Z' } },
            },
          },
        },
        '400': errorResponse('Invalid body.'),
        '401': errorResponse('Bad credentials.'),
      },
    },
  },
  '/api/v1/auth/logout': {
    post: {
      operationId: 'logout',
      summary: 'Log out',
      description:
        'Revokes the current token by adding it to a server-side denylist until it expires, so it cannot be used again.',
      tags: ['Auth'],
      security: bearer,
      responses: {
        '204': { description: 'Logged out.' },
        '401': errorResponse('Missing, invalid or expired token.'),
      },
    },
  },
  '/api/v1/me': {
    get: {
      operationId: 'getMe',
      summary: 'Current user',
      description: 'The user the token belongs to (role and language included).',
      tags: ['Auth'],
      security: bearer,
      responses: {
        '200': dataResponse('Current user.', 'User'),
        '401': errorResponse('Missing, invalid or expired token.'),
      },
    },
    patch: {
      operationId: 'updateMe',
      summary: 'Update the current user',
      description:
        "Updates the user's name and/or language (at least one). role, email and workspaceId cannot be changed.",
      tags: ['Auth'],
      security: bearer,
      responses: {
        '200': dataResponse('Updated user.', 'User'),
        '400': errorResponse('Invalid body.'),
        '401': errorResponse('Missing, invalid or expired token.'),
      },
    },
  },
  '/api/v1/users': {
    get: {
      operationId: 'listUsers',
      summary: 'People in the workspace',
      description:
        'Every user in the workspace, for owner pickers. Uses the common list parameters; q matches name or email, and sort is name (default) or createdAt, with - for descending.',
      tags: ['Users'],
      security: bearer,
      responses: {
        '200': listDataResponse('Workspace users.', 'User'),
        '400': errorResponse('Invalid query, including an unsupported sort.'),
        '401': errorResponse('Missing, invalid or expired token.'),
      },
    },
  },
};

// Machine-readable mirror of the "Operations and health" section in docs/api.md.
// Add every newly implemented endpoint here in the same pull request.
const overviewPaths: OpenApiPaths = {
  '/api/v1/overview': {
    get: {
      operationId: 'getOverview',
      summary: 'Overview summary',
      security: bearer,
      description:
        'One call for the Overview page: contact count and change against last month, open and weighted pipeline, follow-ups due, AI signals, pipeline by stage, recent contacts and activity. Computed by buildOverview in packages/shared; "due today" uses UTC.',
      tags: ['Overview'],
      responses: {
        '200': dataResponse('The overview.', 'Overview'),
        '401': errorResponse('Not authenticated.'),
      },
    },
  },
};

const editNote = 'Needs permission to edit settings (settings: edit).';

const readWriteSetting = (
  name: string,
  component: 'RolePermissions' | 'ConsentSettings' | 'NotificationSettings' | 'AiSettings',
  readDescription: string,
) => ({
  get: {
    operationId: `get${name}`,
    summary: `Get ${name.toLowerCase()} settings`,
    security: bearer,
    description: `${readDescription} Any signed-in user can read it.`,
    tags: ['Settings'],
    responses: {
      '200': dataResponse('The settings.', component),
      '401': errorResponse('Not authenticated.'),
    },
  },
  put: {
    operationId: `put${name}`,
    summary: `Replace ${name.toLowerCase()} settings`,
    security: bearer,
    description: `Replaces the whole object. ${editNote}`,
    tags: ['Settings'],
    requestBody: jsonBody(component),
    responses: {
      '200': dataResponse('The saved settings.', component),
      '400': errorResponse('Invalid or incomplete body.'),
      '401': errorResponse('Not authenticated.'),
      '403': errorResponse('The role may not edit settings.'),
    },
  },
});

const settingsPaths: OpenApiPaths = {
  '/api/v1/settings/custom-fields': {
    get: {
      operationId: 'listCustomFields',
      summary: 'List custom contact fields',
      security: bearer,
      description: 'Any signed-in user can read them (the contact form shows them).',
      tags: ['Settings'],
      responses: {
        '200': listDataResponse('The custom fields.', 'CustomField'),
        '401': errorResponse('Not authenticated.'),
      },
    },
    post: {
      operationId: 'createCustomField',
      summary: 'Add a custom contact field',
      security: bearer,
      description: `The key is set once (fieldKeyFromLabel in packages/shared). A select field needs options. ${editNote}`,
      tags: ['Settings'],
      requestBody: jsonBody('CustomFieldCreate'),
      responses: {
        '201': dataResponse('The created field.', 'CustomField'),
        '400': errorResponse('Invalid body, for example a select without options.'),
        '401': errorResponse('Not authenticated.'),
        '403': errorResponse('The role may not edit settings.'),
        '409': errorResponse('CUSTOM_FIELD_KEY_TAKEN.'),
      },
    },
  },
  '/api/v1/settings/custom-fields/{id}': {
    patch: {
      operationId: 'updateCustomField',
      summary: 'Edit a custom contact field',
      security: bearer,
      description: `Only label and options; the key and type never change. ${editNote}`,
      tags: ['Settings'],
      parameters: [idParam],
      requestBody: jsonBody('CustomFieldUpdate'),
      responses: {
        '200': dataResponse('The updated field.', 'CustomField'),
        '400': errorResponse('Invalid body, including key or type.'),
        '401': errorResponse('Not authenticated.'),
        '403': errorResponse('The role may not edit settings.'),
        '404': errorResponse('CUSTOM_FIELD_NOT_FOUND.'),
      },
    },
    delete: {
      operationId: 'deleteCustomField',
      summary: 'Delete a custom contact field',
      security: bearer,
      description: `Soft delete; the key can be used again. ${editNote}`,
      tags: ['Settings'],
      parameters: [idParam],
      responses: {
        '204': { description: 'Deleted.' },
        '401': errorResponse('Not authenticated.'),
        '403': errorResponse('The role may not edit settings.'),
        '404': errorResponse('CUSTOM_FIELD_NOT_FOUND.'),
      },
    },
  },
  '/api/v1/settings/stages': {
    post: {
      operationId: 'createStage',
      summary: 'Add a deal stage',
      security: bearer,
      description: `A new open stage after the other open stages; Won and Lost stay last. ${editNote}`,
      tags: ['Settings'],
      requestBody: jsonBody('StageCreate'),
      responses: {
        '201': dataResponse('The created stage.', 'Stage'),
        '400': errorResponse('Invalid body.'),
        '401': errorResponse('Not authenticated.'),
        '403': errorResponse('The role may not edit settings.'),
        '404': errorResponse('PIPELINE_NOT_FOUND.'),
      },
    },
  },
  '/api/v1/settings/stages/{id}': {
    patch: {
      operationId: 'updateStage',
      summary: 'Rename, reprice or move a stage',
      security: bearer,
      description: `name, probability, and order (position among the open stages). Renaming a default stage clears its key. Existing deals keep their probability. ${editNote}`,
      tags: ['Settings'],
      parameters: [idParam],
      requestBody: jsonBody('StageUpdate'),
      responses: {
        '200': dataResponse('The updated stage.', 'Stage'),
        '400': errorResponse('Invalid body.'),
        '401': errorResponse('Not authenticated.'),
        '403': errorResponse('The role may not edit settings.'),
        '404': errorResponse('STAGE_NOT_FOUND.'),
      },
    },
    delete: {
      operationId: 'deleteStage',
      summary: 'Delete a stage',
      security: bearer,
      description: `Only open stages without deals. ${editNote}`,
      tags: ['Settings'],
      parameters: [idParam],
      responses: {
        '204': { description: 'Deleted.' },
        '401': errorResponse('Not authenticated.'),
        '403': errorResponse('The role may not edit settings.'),
        '404': errorResponse('STAGE_NOT_FOUND.'),
        '409': errorResponse('STAGE_LOCKED (Won or Lost) or STAGE_IN_USE (has deals).'),
      },
    },
  },
  '/api/v1/settings/roles': readWriteSetting(
    'Roles',
    'RolePermissions',
    'What admins and members may do per resource; owners can always do everything. The role guard uses it at once.',
  ),
  '/api/v1/settings/consent': readWriteSetting(
    'Consent',
    'ConsentSettings',
    'Consent and privacy rules, including what imported contacts get.',
  ),
  '/api/v1/settings/notifications': readWriteSetting(
    'Notifications',
    'NotificationSettings',
    'In-app and email channels per event.',
  ),
  '/api/v1/settings/ai': readWriteSetting(
    'Ai',
    'AiSettings',
    'The AI switches shown on the AI Analysis page.',
  ),
};

const importPaths: OpenApiPaths = {
  '/api/v1/imports': {
    post: {
      operationId: 'uploadImport',
      summary: 'Upload a contact file',
      security: bearer,
      description:
        'multipart/form-data with the file in the field "file": CSV (comma, semicolon or tab) or XLSX (first sheet), up to 10,000 rows and 10 MB. Returns the job with its columns, the first row and a guessed mapping.',
      tags: ['Import'],
      requestBody: {
        required: true,
        content: {
          'multipart/form-data': {
            schema: {
              type: 'object',
              required: ['file'],
              properties: { file: { type: 'string', format: 'binary' } },
            },
          },
        },
      },
      responses: {
        '201': dataResponse('The uploaded import job.', 'ImportJob'),
        '400': errorResponse('IMPORT_FILE_UNREADABLE, IMPORT_EMPTY or IMPORT_TOO_MANY_ROWS.'),
        '401': errorResponse('Not authenticated.'),
        '403': errorResponse('The role may not create imports.'),
      },
    },
  },
  '/api/v1/imports/{id}': {
    get: {
      operationId: 'getImport',
      summary: 'Get an import job',
      security: bearer,
      description:
        'Status (uploaded, processing, done, failed), counts and mapping. Poll it while processing.',
      tags: ['Import'],
      parameters: [idParam],
      responses: {
        '200': dataResponse('The import job.', 'ImportJob'),
        '401': errorResponse('Not authenticated.'),
        '404': errorResponse('IMPORT_NOT_FOUND.'),
      },
    },
  },
  '/api/v1/imports/{id}/mapping': {
    put: {
      operationId: 'saveImportMapping',
      summary: 'Save the field mapping',
      security: bearer,
      description:
        'Only the columns of the uploaded file, and only before the import is confirmed.',
      tags: ['Import'],
      parameters: [idParam],
      requestBody: jsonBody('ImportMappingInput'),
      responses: {
        '200': dataResponse('The updated job.', 'ImportJob'),
        '400': errorResponse('Invalid mapping or an unknown column.'),
        '401': errorResponse('Not authenticated.'),
        '404': errorResponse('IMPORT_NOT_FOUND.'),
        '409': errorResponse('IMPORT_ALREADY_STARTED.'),
      },
    },
  },
  '/api/v1/imports/{id}/preview': {
    get: {
      operationId: 'previewImport',
      summary: 'Preview the import',
      security: bearer,
      description:
        'Counts for the whole file (new, duplicates, problems) and the first 20 rows as they will be imported.',
      tags: ['Import'],
      parameters: [idParam],
      responses: {
        '200': dataResponse('The preview.', 'ImportPreview'),
        '401': errorResponse('Not authenticated.'),
        '404': errorResponse('IMPORT_NOT_FOUND.'),
      },
    },
  },
  '/api/v1/imports/{id}/confirm': {
    post: {
      operationId: 'confirmImport',
      summary: 'Start the import',
      security: bearer,
      description:
        'Saves the default owner, tag and duplicate handling (hold, skip, update), then queues the import.process background job and answers at once with status processing.',
      tags: ['Import'],
      parameters: [idParam],
      requestBody: jsonBody('ImportConfirm'),
      responses: {
        '200': dataResponse('The job, now processing.', 'ImportJob'),
        '400': errorResponse('Invalid options or an unknown owner.'),
        '401': errorResponse('Not authenticated.'),
        '404': errorResponse('IMPORT_NOT_FOUND.'),
        '409': errorResponse('IMPORT_ALREADY_STARTED.'),
      },
    },
  },
  '/api/v1/imports/{id}/held': {
    get: {
      operationId: 'listHeldRows',
      summary: 'Held duplicates',
      security: bearer,
      description: 'Rows held as possible duplicates, waiting for a decision.',
      tags: ['Import'],
      parameters: [idParam],
      responses: {
        '200': listDataResponse('The held rows.', 'HeldRow'),
        '401': errorResponse('Not authenticated.'),
        '404': errorResponse('IMPORT_NOT_FOUND.'),
      },
    },
  },
  '/api/v1/imports/{id}/held/{rowId}/resolve': {
    post: {
      operationId: 'resolveHeldRow',
      summary: 'Resolve a held duplicate',
      security: bearer,
      description:
        'skip drops the row; create adds it as a new contact; merge fills the empty fields of the existing contact and adds tags, never overwriting. Needs permission to edit contacts.',
      tags: ['Import'],
      parameters: [
        idParam,
        { name: 'rowId', in: 'path', required: true, schema: { type: 'string' } },
      ],
      requestBody: jsonBody('ImportResolve'),
      responses: {
        '200': dataResponse('The resolved row.', 'HeldRow'),
        '401': errorResponse('Not authenticated.'),
        '403': errorResponse('The role may not edit contacts.'),
        '404': errorResponse('IMPORT_NOT_FOUND or IMPORT_ROW_NOT_FOUND.'),
      },
    },
  },
};

const aiPaths: OpenApiPaths = {
  '/api/v1/contacts/{id}/ai-analysis': {
    post: {
      operationId: 'runAiAnalysis',
      summary: 'Analyse a contact',
      security: bearer,
      description:
        'Queues the ai.analyze background job and answers at once. Poll GET /contacts/{id}/ai-insights for the result. The simulated provider answers until a model is connected.',
      tags: ['AI'],
      parameters: [idParam],
      responses: {
        '200': dataResponse('The queued job.', 'AiRun'),
        '401': errorResponse('Not authenticated.'),
        '404': errorResponse('CONTACT_NOT_FOUND.'),
      },
    },
  },
  '/api/v1/contacts/{id}/ai-insights': {
    get: {
      operationId: 'getLatestAiInsight',
      summary: 'Latest insight for a contact',
      security: bearer,
      description:
        'The newest insight (suggested, accepted or dismissed), or data: null. AI text is { key, params } from the simulated provider or { text, language } from a model.',
      tags: ['AI'],
      parameters: [idParam],
      responses: {
        '200': dataResponse('The latest insight, or null.', 'AiInsight'),
        '401': errorResponse('Not authenticated.'),
        '404': errorResponse('CONTACT_NOT_FOUND.'),
      },
    },
  },
  '/api/v1/ai-insights/{id}/accept': {
    post: {
      operationId: 'acceptAiInsight',
      summary: 'Accept an insight',
      security: bearer,
      description:
        'The only way an insight changes a record: saves only the ticked changes (the suggested task with the confirmed title, the suggested stage) in one transaction and logs an ai_signal activity. Needs permission to edit contacts.',
      tags: ['AI'],
      parameters: [idParam],
      requestBody: jsonBody('AiAccept'),
      responses: {
        '200': dataResponse('The accepted insight.', 'AiInsight'),
        '400': errorResponse('Invalid body, for example createTask without taskTitle.'),
        '401': errorResponse('Not authenticated.'),
        '403': errorResponse('The role may not edit contacts.'),
        '404': errorResponse('AI_INSIGHT_NOT_FOUND.'),
        '409': errorResponse('AI_INSIGHT_CLOSED: already accepted or dismissed.'),
      },
    },
  },
  '/api/v1/ai-insights/{id}/dismiss': {
    post: {
      operationId: 'dismissAiInsight',
      summary: 'Dismiss an insight',
      security: bearer,
      description: 'Closes the insight; nothing is saved.',
      tags: ['AI'],
      parameters: [idParam],
      responses: {
        '204': { description: 'Dismissed.' },
        '401': errorResponse('Not authenticated.'),
        '404': errorResponse('AI_INSIGHT_NOT_FOUND.'),
        '409': errorResponse('AI_INSIGHT_CLOSED.'),
      },
    },
  },
};

export const paths: OpenApiPaths = {
  '/health': {
    get: {
      operationId: 'getHealth',
      summary: 'Readiness check',
      description:
        'Checks Postgres and Redis. Each dependency check is bounded by a timeout (CHECK_TIMEOUT_MS, 2000ms) so a hung database cannot hang the response. Returns 200 when both are up, 503 when either is down. Unauthenticated.',
      tags: ['Operations'],
      security: [],
      responses: {
        '200': {
          description: 'All dependencies are up.',
          content: {
            'application/json': {
              schema: { $ref: schemaRef('HealthStatus') },
              example: {
                data: { status: 'ok', checks: { database: 'ok', redis: 'ok' } },
              },
            },
          },
        },
        '503': {
          description: 'At least one dependency is down.',
          content: {
            'application/json': {
              schema: { $ref: schemaRef('HealthStatus') },
              example: {
                data: { status: 'degraded', checks: { database: 'down', redis: 'ok' } },
              },
            },
          },
        },
      },
    },
  },
  '/health/live': {
    get: {
      operationId: 'getHealthLive',
      summary: 'Liveness check',
      description:
        'Always returns 200 and touches no dependency — use it to detect a hung process. Unauthenticated.',
      tags: ['Operations'],
      security: [],
      responses: {
        '200': {
          description: 'Process is alive.',
          content: {
            'application/json': {
              schema: { $ref: schemaRef('HealthLiveStatus') },
              example: { data: { status: 'ok' } },
            },
          },
        },
      },
    },
  },
  '/api/v1/health': {
    get: {
      operationId: 'getHealthVersioned',
      summary: 'Readiness check (versioned alias)',
      description:
        'Alias of GET /health, for clients that only know the versioned /api/v1 base path. Unauthenticated.',
      tags: ['Operations'],
      security: [],
      responses: {
        '200': {
          description: 'All dependencies are up.',
          content: {
            'application/json': {
              schema: { $ref: schemaRef('HealthStatus') },
              example: {
                data: { status: 'ok', checks: { database: 'ok', redis: 'ok' } },
              },
            },
          },
        },
        '503': {
          description: 'At least one dependency is down.',
          content: {
            'application/json': {
              schema: { $ref: schemaRef('HealthStatus') },
              example: {
                data: { status: 'degraded', checks: { database: 'down', redis: 'ok' } },
              },
            },
          },
        },
      },
    },
  },
  ...authPaths,
  ...contactsPaths,
  ...companiesPaths,
  ...dealPaths,
  ...aiPaths,
  ...importPaths,
  ...settingsPaths,
  ...overviewPaths,
};
