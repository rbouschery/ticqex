export type HttpMethod = "GET" | "POST" | "PATCH" | "PUT" | "DELETE";

export type OperationDefinition = {
  name: string;
  method: HttpMethod;
  pathTemplate: string;
  pathParams: string[];
  queryParams: string[];
  bodyKey?: string | null;
  admin?: boolean;
  alias?: string[];
};

export const OPERATION_CATALOG: OperationDefinition[] = [
  {
    name: "ticqex_get_me",
    method: "GET",
    pathTemplate: "/users/me",
    pathParams: [],
    queryParams: [],
  },
  {
    name: "ticqex_list_users",
    method: "GET",
    pathTemplate: "/users",
    pathParams: [],
    queryParams: [],
  },
  {
    name: "ticqex_list_tickets",
    method: "GET",
    pathTemplate: "/tickets",
    pathParams: [],
    queryParams: [
      "page",
      "per_page",
      "status_id",
      "assignee_id",
      "contact_id",
      "origin",
      "kind",
      "channel",
      "tag",
    ],
  },
  {
    name: "ticqex_create_ticket",
    method: "POST",
    pathTemplate: "/tickets",
    pathParams: [],
    queryParams: [],
    bodyKey: null,
  },
  {
    name: "ticqex_get_ticket",
    method: "GET",
    pathTemplate: "/tickets/:id",
    pathParams: ["id"],
    queryParams: [],
  },
  {
    name: "ticqex_get_ticket_summary",
    method: "GET",
    pathTemplate: "/tickets/:id/summary",
    pathParams: ["id"],
    queryParams: [],
  },
  {
    name: "ticqex_get_ticket_context",
    method: "GET",
    pathTemplate: "/tickets/:id/context",
    pathParams: ["id"],
    queryParams: [],
  },
  {
    name: "ticqex_update_ticket",
    method: "PATCH",
    pathTemplate: "/tickets/:id",
    pathParams: ["id"],
    queryParams: [],
    bodyKey: "patch",
  },
  {
    name: "ticqex_delete_ticket",
    method: "DELETE",
    pathTemplate: "/tickets/:id",
    pathParams: ["id"],
    queryParams: [],
  },
  {
    name: "ticqex_list_ticket_messages",
    method: "GET",
    pathTemplate: "/tickets/:ticket_id/messages",
    pathParams: ["ticket_id"],
    queryParams: [],
  },
  {
    name: "ticqex_create_ticket_message",
    method: "POST",
    pathTemplate: "/tickets/:ticket_id/messages",
    pathParams: ["ticket_id"],
    queryParams: [],
    bodyKey: "message",
  },
  {
    name: "ticqex_list_ticket_comments",
    method: "GET",
    pathTemplate: "/tickets/:ticket_id/comments",
    pathParams: ["ticket_id"],
    queryParams: ["page", "per_page"],
  },
  {
    name: "ticqex_create_ticket_comment",
    method: "POST",
    pathTemplate: "/tickets/:ticket_id/comments",
    pathParams: ["ticket_id"],
    queryParams: [],
    bodyKey: "comment",
  },
  {
    name: "ticqex_update_ticket_comment",
    method: "PATCH",
    pathTemplate: "/tickets/:ticket_id/comments/:comment_id",
    pathParams: ["ticket_id", "comment_id"],
    queryParams: [],
    bodyKey: "comment",
  },
  {
    name: "ticqex_delete_ticket_comment",
    method: "DELETE",
    pathTemplate: "/tickets/:ticket_id/comments/:comment_id",
    pathParams: ["ticket_id", "comment_id"],
    queryParams: [],
  },
  {
    name: "ticqex_create_ticket_draft",
    method: "POST",
    pathTemplate: "/tickets/:ticket_id/messages/drafts",
    pathParams: ["ticket_id"],
    queryParams: [],
    bodyKey: "message",
  },
  {
    name: "ticqex_list_ticket_drafts",
    method: "GET",
    pathTemplate: "/tickets/:ticket_id/messages/drafts",
    pathParams: ["ticket_id"],
    queryParams: [],
  },
  {
    name: "ticqex_update_ticket_draft",
    method: "PATCH",
    pathTemplate: "/tickets/:ticket_id/messages/drafts/:message_id",
    pathParams: ["ticket_id", "message_id"],
    queryParams: [],
    bodyKey: "message",
  },
  {
    name: "ticqex_send_ticket_draft",
    method: "POST",
    pathTemplate: "/tickets/:ticket_id/messages/drafts/:message_id/send",
    pathParams: ["ticket_id", "message_id"],
    queryParams: [],
    bodyKey: "options",
  },
  {
    name: "ticqex_delete_ticket_draft",
    method: "DELETE",
    pathTemplate: "/tickets/:ticket_id/messages/drafts/:message_id",
    pathParams: ["ticket_id", "message_id"],
    queryParams: [],
  },
  {
    name: "ticqex_mark_ticket_read",
    method: "POST",
    pathTemplate: "/tickets/:ticket_id/read",
    pathParams: ["ticket_id"],
    queryParams: [],
  },
  {
    name: "ticqex_set_message_read",
    method: "PATCH",
    pathTemplate: "/tickets/:ticket_id/messages/:message_id/read",
    pathParams: ["ticket_id", "message_id"],
    queryParams: [],
    bodyKey: null,
  },
  {
    name: "ticqex_get_attachment_url",
    method: "GET",
    pathTemplate: "/messages/:message_id/attachments/:attachment_id",
    pathParams: ["message_id", "attachment_id"],
    queryParams: ["download", "format"],
  },
  {
    name: "ticqex_stage_ticket_attachment_upload",
    method: "POST",
    pathTemplate: "/tickets/:ticket_id/attachment-uploads",
    pathParams: ["ticket_id"],
    queryParams: [],
    bodyKey: null,
  },
  {
    name: "ticqex_get_board",
    method: "GET",
    pathTemplate: "/board",
    pathParams: [],
    queryParams: ["filter", "sort", "q"],
  },
  {
    name: "ticqex_get_board_filter_options",
    method: "GET",
    pathTemplate: "/board/filter-options",
    pathParams: [],
    queryParams: [],
  },
  {
    name: "ticqex_get_board_lane_tickets",
    method: "GET",
    pathTemplate: "/board/lanes/:status_id/tickets",
    pathParams: ["status_id"],
    queryParams: ["offset", "limit", "filter", "sort"],
  },
  {
    name: "ticqex_set_board_lane_order",
    method: "PUT",
    pathTemplate: "/board/lanes/:status_id/order",
    pathParams: ["status_id"],
    queryParams: [],
    bodyKey: "order",
  },
  {
    name: "ticqex_seed_manual_board_orders",
    method: "PUT",
    pathTemplate: "/board/manual-order",
    pathParams: [],
    queryParams: [],
    bodyKey: null,
  },
  {
    name: "ticqex_move_ticket_on_board",
    method: "POST",
    pathTemplate: "/board/move-ticket",
    pathParams: [],
    queryParams: [],
    bodyKey: null,
  },
  {
    name: "ticqex_list_contacts",
    method: "GET",
    pathTemplate: "/contacts",
    pathParams: [],
    queryParams: [],
  },
  {
    name: "ticqex_get_contact",
    method: "GET",
    pathTemplate: "/contacts/:id",
    pathParams: ["id"],
    queryParams: [],
  },
  {
    name: "ticqex_create_contact",
    method: "POST",
    pathTemplate: "/contacts",
    pathParams: [],
    queryParams: [],
    bodyKey: null,
  },
  {
    name: "ticqex_update_contact",
    method: "PATCH",
    pathTemplate: "/contacts/:id",
    pathParams: ["id"],
    queryParams: [],
    bodyKey: null,
  },
  {
    name: "ticqex_delete_contact",
    method: "DELETE",
    pathTemplate: "/contacts/:id",
    pathParams: ["id"],
    queryParams: [],
  },
  {
    name: "ticqex_list_tags",
    method: "GET",
    pathTemplate: "/tags",
    pathParams: [],
    queryParams: [],
  },
  {
    name: "ticqex_create_tag",
    method: "POST",
    pathTemplate: "/tags",
    pathParams: [],
    queryParams: [],
    bodyKey: null,
  },
  {
    name: "ticqex_update_tag",
    method: "PATCH",
    pathTemplate: "/tags/:id",
    pathParams: ["id"],
    queryParams: [],
    bodyKey: null,
  },
  {
    name: "ticqex_delete_tag",
    method: "DELETE",
    pathTemplate: "/tags/:id",
    pathParams: ["id"],
    queryParams: [],
  },
  {
    name: "ticqex_list_statuses",
    method: "GET",
    pathTemplate: "/statuses",
    pathParams: [],
    queryParams: [],
  },
  {
    name: "ticqex_create_status",
    method: "POST",
    pathTemplate: "/statuses",
    pathParams: [],
    queryParams: [],
    bodyKey: null,
  },
  {
    name: "ticqex_update_status",
    method: "PATCH",
    pathTemplate: "/statuses/:id",
    pathParams: ["id"],
    queryParams: [],
    bodyKey: null,
  },
  {
    name: "ticqex_delete_status",
    method: "DELETE",
    pathTemplate: "/statuses/:id",
    pathParams: ["id"],
    queryParams: [],
  },
  {
    name: "ticqex_reorder_statuses",
    method: "PUT",
    pathTemplate: "/statuses/reorder",
    pathParams: [],
    queryParams: [],
    bodyKey: null,
  },
  {
    name: "ticqex_list_custom_fields",
    method: "GET",
    pathTemplate: "/custom-fields",
    pathParams: [],
    queryParams: ["group"],
  },
  {
    name: "ticqex_create_custom_field",
    method: "POST",
    pathTemplate: "/custom-fields",
    pathParams: [],
    queryParams: [],
    bodyKey: null,
  },
  {
    name: "ticqex_update_custom_field",
    method: "PATCH",
    pathTemplate: "/custom-fields/:id",
    pathParams: ["id"],
    queryParams: [],
    bodyKey: null,
  },
  {
    name: "ticqex_delete_custom_field",
    method: "DELETE",
    pathTemplate: "/custom-fields/:id",
    pathParams: ["id"],
    queryParams: [],
  },
  {
    name: "ticqex_reorder_custom_fields",
    method: "PUT",
    pathTemplate: "/custom-fields/reorder",
    pathParams: [],
    queryParams: [],
    bodyKey: null,
  },
  {
    name: "ticqex_get_settings",
    method: "GET",
    pathTemplate: "/settings",
    pathParams: [],
    queryParams: [],
  },
  {
    name: "ticqex_patch_settings",
    method: "PATCH",
    pathTemplate: "/settings",
    pathParams: [],
    queryParams: [],
    bodyKey: null,
  },
  {
    name: "ticqex_list_email_snippets",
    method: "GET",
    pathTemplate: "/email-snippets",
    pathParams: [],
    queryParams: [],
  },
  {
    name: "ticqex_create_email_snippet",
    method: "POST",
    pathTemplate: "/email-snippets",
    pathParams: [],
    queryParams: [],
    bodyKey: null,
  },
  {
    name: "ticqex_delete_email_snippet",
    method: "DELETE",
    pathTemplate: "/email-snippets/:id",
    pathParams: ["id"],
    queryParams: [],
  },
  {
    name: "ticqex_list_api_keys",
    method: "GET",
    pathTemplate: "/api-keys",
    pathParams: [],
    queryParams: [],
    admin: true,
  },
  {
    name: "ticqex_create_api_key",
    method: "POST",
    pathTemplate: "/api-keys",
    pathParams: [],
    queryParams: [],
    bodyKey: null,
    admin: true,
  },
  {
    name: "ticqex_revoke_api_key",
    method: "DELETE",
    pathTemplate: "/api-keys/:id",
    pathParams: ["id"],
    queryParams: [],
    admin: true,
  },
];

export const MCP_TOOL_NAMES = OPERATION_CATALOG.filter((op) => !op.admin).map(
  (op) => op.name,
);

export const REST_ONLY_ADMIN_OPERATIONS = OPERATION_CATALOG.filter(
  (op) => op.admin,
).map((op) => op.name);

const operationsByName = new Map<string, OperationDefinition>();

for (const operation of OPERATION_CATALOG) {
  operationsByName.set(operation.name, operation);
  if (operation.alias) {
    for (const alias of operation.alias) {
      operationsByName.set(alias, operation);
    }
  }
}

export function getOperation(name: string): OperationDefinition | undefined {
  return operationsByName.get(name);
}

export function listOperationNames(): string[] {
  return OPERATION_CATALOG.map((op) => op.name);
}

export function toOpenApiPath(pathTemplate: string): string {
  return pathTemplate.replace(/:([a-z_]+)/g, "{$1}");
}

export function inferOperationTag(pathTemplate: string): string {
  const segment = pathTemplate.split("/").filter(Boolean)[0] ?? "api";
  return segment.replace(/-/g, "_");
}

export function operationSummary(name: string): string {
  const withoutPrefix = name.replace(/^ticqex_/, "").replaceAll("_", " ");
  return withoutPrefix.charAt(0).toUpperCase() + withoutPrefix.slice(1);
}
