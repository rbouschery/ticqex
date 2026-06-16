import { z } from "zod";
import {
  OPERATION_CATALOG,
  inferOperationTag,
  operationSummary,
  toOpenApiPath,
  type OperationDefinition,
} from "@ticqex/api-spec";
import {
  REQUEST_BODY_BY_OPERATION,
} from "./request-schemas.js";

type JsonSchema = Record<string, unknown>;

type OpenApiParameter = {
  name: string;
  in: "path" | "query";
  required?: boolean;
  description?: string;
  schema: JsonSchema;
};

type OpenApiOperation = {
  operationId: string;
  summary: string;
  description?: string;
  tags: string[];
  parameters?: OpenApiParameter[];
  requestBody?: Record<string, unknown>;
  responses: Record<string, unknown>;
  security: [{ bearerAuth: [] }];
};

type OpenApiTag = {
  name: string;
  description?: string;
  "x-displayName"?: string;
};

type OpenApiServer = {
  url: string;
  description: string;
  variables?: Record<
    string,
    {
      default: string;
      description: string;
    }
  >;
};

type OpenApiDocument = {
  openapi: string;
  info: {
    title: string;
    version: string;
    description: string;
  };
  servers: OpenApiServer[];
  tags: OpenApiTag[];
  paths: Record<string, Record<string, OpenApiOperation>>;
  components: {
    schemas: Record<string, JsonSchema>;
    securitySchemes: Record<string, unknown>;
  };
  security: [{ bearerAuth: [] }];
};

const INTEGER_QUERY_PARAMS = new Set([
  "page",
  "per_page",
  "offset",
  "limit",
]);

const BOOLEAN_QUERY_PARAMS = new Set(["download"]);

const ENUM_QUERY_PARAMS: Record<string, string[]> = {
  format: ["json"],
  group: ["ticket", "contact"],
};

const TAG_METADATA: Record<
  string,
  { displayName: string; description: string }
> = {
  api_keys: {
    displayName: "API keys",
    description: "Create and revoke API keys for REST, MCP, and CLI access.",
  },
  board: {
    displayName: "Board",
    description: "Kanban board views, lane ordering, and ticket moves.",
  },
  contacts: {
    displayName: "Contacts",
    description: "Customer and contact records linked to tickets.",
  },
  custom_fields: {
    displayName: "Custom fields",
    description: "Ticket and contact field definitions and ordering.",
  },
  email_snippets: {
    displayName: "Email snippets",
    description: "Reusable canned responses for outbound email.",
  },
  messages: {
    displayName: "Messages",
    description: "Message attachments and signed download URLs.",
  },
  settings: {
    displayName: "Settings",
    description: "Workspace configuration and preferences.",
  },
  statuses: {
    displayName: "Statuses",
    description: "Ticket workflow statuses and lane ordering.",
  },
  tags: {
    displayName: "Tags",
    description: "Labels applied to tickets for filtering and organization.",
  },
  tickets: {
    displayName: "Tickets",
    description: "Tickets, messages, drafts, comments, and read state.",
  },
  users: {
    displayName: "Users",
    description: "Staff users and the authenticated session identity.",
  },
};

const QUERY_PARAM_DESCRIPTIONS: Record<string, string> = {
  page: "Page number (1-based).",
  per_page: "Number of items per page.",
  offset: "Zero-based offset for pagination.",
  limit: "Maximum number of items to return.",
  status_id: "Filter tickets by status UUID.",
  assignee_id: "Filter tickets by assignee user UUID.",
  contact_id: "Filter tickets by contact UUID.",
  origin: "Filter tickets by origin (for example email, api, or manual).",
  kind: "Filter tickets by kind.",
  channel: "Filter tickets by channel identifier.",
  tag: "Filter tickets by tag name.",
  filter: "Board filter expression.",
  sort: "Sort order for board or lane results.",
  q: "Search query for the board.",
  download:
    "When true, force the signed URL to include a Content-Disposition attachment header.",
  format:
    'Response format. Use "json" to receive `{ data: { url } }` instead of a redirect.',
  group:
    'Filter custom field definitions by group. One of "ticket" or "contact".',
};

function zodToOpenApiSchema(schema: z.ZodType): JsonSchema {
  return z.toJSONSchema(schema, { unrepresentable: "any" }) as JsonSchema;
}

function buildSharedSchemas(): Record<string, JsonSchema> {
  const schemas: Record<string, JsonSchema> = {
    ApiError: {
      type: "object",
      required: ["error"],
      properties: {
        error: {
          type: "object",
          required: ["code", "message"],
          properties: {
            code: { type: "string" },
            message: { type: "string" },
          },
        },
      },
    },
    DataEnvelope: {
      type: "object",
      required: ["data"],
      properties: {
        data: {},
      },
    },
    ListEnvelope: {
      type: "object",
      required: ["data"],
      properties: {
        data: {
          type: "array",
          items: { type: "object" },
        },
        meta: {
          type: "object",
          additionalProperties: true,
        },
      },
    },
    AttachmentUrlData: {
      type: "object",
      required: ["url"],
      properties: {
        url: {
          type: "string",
          format: "uri",
          description: "Time-limited signed URL for the attachment.",
        },
      },
    },
    AttachmentUploadRequest: {
      type: "object",
      required: ["file"],
      properties: {
        file: {
          type: "string",
          format: "binary",
        },
      },
    },
  };

  for (const [operationName, bodyKind] of Object.entries(
    REQUEST_BODY_BY_OPERATION,
  )) {
    if (bodyKind.kind === "json" || bodyKind.kind === "optional-json") {
      const componentName = `${operationName}Request`;
      schemas[componentName] = zodToOpenApiSchema(bodyKind.schema);
    }
  }

  return schemas;
}

function queryParamSchema(name: string): JsonSchema {
  if (INTEGER_QUERY_PARAMS.has(name)) {
    return { type: "integer" };
  }
  if (BOOLEAN_QUERY_PARAMS.has(name)) {
    return { type: "boolean" };
  }
  const enumValues = ENUM_QUERY_PARAMS[name];
  if (enumValues) {
    return { type: "string", enum: enumValues };
  }
  return { type: "string" };
}

function queryParamDescription(name: string): string | undefined {
  return QUERY_PARAM_DESCRIPTIONS[name];
}

function buildParameters(operation: OperationDefinition): OpenApiParameter[] {
  const parameters: OpenApiParameter[] = [];

  for (const paramName of operation.pathParams) {
    parameters.push({
      name: paramName,
      in: "path",
      required: true,
      schema: { type: "string", format: "uuid" },
    });
  }

  for (const queryName of operation.queryParams) {
    const parameter: OpenApiParameter = {
      name: queryName,
      in: "query",
      required: false,
      schema: queryParamSchema(queryName),
    };
    const description = queryParamDescription(queryName);
    if (description) {
      parameter.description = description;
    }
    parameters.push(parameter);
  }

  if (operation.name === "ticqex_list_tickets") {
    parameters.push({
      name: "custom_fields.{key}",
      in: "query",
      required: false,
      description:
        "Filter by custom field value. Use query keys like custom_fields.my_field=value.",
      schema: { type: "string" },
    });
  }

  return parameters;
}

function successResponse(operation: OperationDefinition): Record<string, unknown> {
  if (operation.name === "ticqex_get_attachment_url") {
    return {
      "302": {
        description:
          "Redirects to a time-limited signed URL for the attachment. This is the default response when format is omitted.",
        headers: {
          Location: {
            description: "Signed attachment URL.",
            schema: { type: "string", format: "uri" },
          },
        },
      },
      "200": {
        description:
          'Returned when format=json. Wraps the signed URL in the standard `{ data: { url } }` envelope.',
        content: {
          "application/json": {
            schema: {
              type: "object",
              required: ["data"],
              properties: {
                data: { $ref: "#/components/schemas/AttachmentUrlData" },
              },
            },
          },
        },
      },
    };
  }

  const isList =
    operation.method === "GET" &&
    (operation.name.startsWith("ticqex_list_") ||
      operation.name === "ticqex_get_board_lane_tickets");

  const isDelete = operation.method === "DELETE";

  if (isDelete) {
    return {
      "200": {
        description: "Resource deleted",
        content: {
          "application/json": {
            schema: { $ref: "#/components/schemas/DataEnvelope" },
          },
        },
      },
    };
  }

  if (isList) {
    return {
      "200": {
        description: "Success",
        content: {
          "application/json": {
            schema: { $ref: "#/components/schemas/ListEnvelope" },
          },
        },
      },
    };
  }

  const status = operation.method === "POST" ? "201" : "200";
  return {
    [status]: {
      description: "Success",
      content: {
        "application/json": {
          schema: { $ref: "#/components/schemas/DataEnvelope" },
        },
      },
    },
  };
}

function buildRequestBody(
  operation: OperationDefinition,
): Record<string, unknown> | undefined {
  const bodyKind = REQUEST_BODY_BY_OPERATION[operation.name];
  if (!bodyKind) {
    return undefined;
  }

  if (bodyKind.kind === "multipart") {
    return {
      required: true,
      content: {
        "multipart/form-data": {
          schema: { $ref: "#/components/schemas/AttachmentUploadRequest" },
        },
      },
    };
  }

  const componentName = `${operation.name}Request`;
  return {
    required: bodyKind.kind === "json",
    content: {
      "application/json": {
        schema: { $ref: `#/components/schemas/${componentName}` },
      },
    },
  };
}

function buildOperation(operation: OperationDefinition): OpenApiOperation {
  const tag = inferOperationTag(operation.pathTemplate);
  const descriptionParts: string[] = [];
  if (operation.admin) {
    descriptionParts.push("Requires admin role.");
  }
  if (operation.name === "ticqex_get_attachment_url") {
    descriptionParts.push(
      "By default this endpoint responds with a 302 redirect to a signed URL. Pass format=json to receive `{ data: { url } }` instead.",
    );
  }
  descriptionParts.push(`MCP tool: \`${operation.name}\`.`);

  const parameters = buildParameters(operation);
  const requestBody = buildRequestBody(operation);

  const op: OpenApiOperation = {
    operationId: operation.name,
    summary: operationSummary(operation.name),
    description: descriptionParts.join(" "),
    tags: [tag],
    responses: {
      ...successResponse(operation),
      "400": {
        description: "Bad request",
        content: {
          "application/json": {
            schema: { $ref: "#/components/schemas/ApiError" },
          },
        },
      },
      "401": {
        description: "Unauthorized",
        content: {
          "application/json": {
            schema: { $ref: "#/components/schemas/ApiError" },
          },
        },
      },
      "403": {
        description: "Forbidden",
        content: {
          "application/json": {
            schema: { $ref: "#/components/schemas/ApiError" },
          },
        },
      },
      "404": {
        description: "Not found",
        content: {
          "application/json": {
            schema: { $ref: "#/components/schemas/ApiError" },
          },
        },
      },
    },
    security: [{ bearerAuth: [] }],
  };

  if (parameters.length > 0) {
    op.parameters = parameters;
  }
  if (requestBody) {
    op.requestBody = requestBody;
  }

  return op;
}

export function buildOpenApiDocument(): OpenApiDocument {
  const paths: Record<string, Record<string, OpenApiOperation>> = {};
  const tagNames = new Set<string>();

  for (const operation of OPERATION_CATALOG) {
    const openApiPath = toOpenApiPath(operation.pathTemplate);
    const method = operation.method.toLowerCase();
    tagNames.add(inferOperationTag(operation.pathTemplate));

    paths[openApiPath] ??= {};
    paths[openApiPath][method] = buildOperation(operation);
  }

  return {
    openapi: "3.1.0",
    info: {
      title: "Ticqex API",
      version: "0.1.0",
      description:
        "REST JSON API for Ticqex at /api/v1. Authenticate with Authorization: Bearer tq_live_* (API key) or a staff Supabase JWT.",
    },
    servers: [
      {
        url: "https://{instanceHost}/api/v1",
        description: "Your Ticqex deployment.",
        variables: {
          instanceHost: {
            default: "your-instance.com",
            description:
              "Hostname of your Ticqex deployment, without protocol or path.",
          },
        },
      },
    ],
    tags: [...tagNames]
      .sort()
      .map((name) => {
        const metadata = TAG_METADATA[name];
        if (!metadata) {
          return { name };
        }
        return {
          name,
          description: metadata.description,
          "x-displayName": metadata.displayName,
        };
      }),
    paths,
    components: {
      schemas: buildSharedSchemas(),
      securitySchemes: {
        bearerAuth: {
          type: "http",
          scheme: "bearer",
          description:
            "API key (tq_live_...) or staff Supabase JWT from browser login.",
        },
      },
    },
    security: [{ bearerAuth: [] }],
  };
}

export function countOpenApiOperations(document: OpenApiDocument): number {
  let count = 0;
  for (const pathItem of Object.values(document.paths)) {
    count += Object.keys(pathItem).length;
  }
  return count;
}
