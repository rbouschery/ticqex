import { z } from "zod";
import type { AuthContext } from "@server/middleware/auth";
import { requireAdmin } from "@server/middleware/auth";
import { ApiError } from "@server/lib/errors";
import { createAdminClient } from "@server/lib/supabase-admin";
import { parseBody } from "@server/lib/validation/schemas";
import {
  boardLaneOrderSchema,
  boardMoveTicketSchema,
  createCustomerSchema,
  createCustomFieldSchema,
  createEmailSnippetSchema,
  createStatusSchema,
  createTagSchema,
  createTicketSchema,
  deleteStatusSchema,
  messageInputSchema,
  patchSettingsSchema,
  reorderStatusesSchema,
  seedManualLaneOrdersSchema,
  toggleMessageReadSchema,
  updateCustomerSchema,
  updateCustomFieldSchema,
  updateStatusSchema,
  updateTagSchema,
  updateTicketSchema,
} from "@server/lib/validation/schemas";
import { loadTicqexConfig } from "@server/config";
import { isChannelOperational } from "@server/config/channel-gate";
import { enqueueChannelOutbound } from "@server/channels/email/background";
import { parseBoardSortParam } from "@server/domain/board-sort";
import { parseTicketFilterParam } from "@server/domain/ticket-filter";
import { getAttachmentSignedUrl } from "@server/services/attachment-uploads";
import { getBoard, getLaneTicketsPage } from "@server/services/board";
import { getBoardFilterOptions } from "@server/services/board-filter-options";
import { setLaneOrder, seedManualLaneOrders } from "@server/services/board-lane-orders";
import { moveTicketOnBoard } from "@server/services/board-move";
import {
  createCustomer,
  deleteCustomer,
  getCustomer,
  listCustomers,
  updateCustomer,
} from "@server/services/customers";
import {
  createDefinition,
  deleteDefinition,
  listDefinitions,
  updateDefinition,
} from "@server/services/custom-fields";
import {
  createEmailSnippet,
  deleteEmailSnippet,
  listEmailSnippets,
} from "@server/services/email-snippets";
import {
  createAgentReply,
  listEnrichedMessages,
} from "@server/services/messages";
import {
  markTicketMessagesRead,
  setMessageReadState,
} from "@server/services/message-reads";
import { getSettings, patchSettings } from "@server/services/settings";
import {
  createStatus,
  deleteStatus,
  listStatuses,
  reorderStatuses,
  updateStatus,
} from "@server/services/statuses";
import { createTag, deleteTag, listTags, updateTag } from "@server/services/tags";
import { getTicketContext } from "@server/services/ticket-context";
import {
  createTicket,
  deleteTicket,
  getTicket,
  getTicketSummary,
  listTickets,
  updateTicket,
} from "@server/services/tickets";
import { getMe, listUsers } from "@server/services/users";
import type { McpServer, ToolCallback } from "@modelcontextprotocol/sdk/server/mcp.js";
import type {
  ShapeOutput,
  ZodRawShapeCompat,
} from "@modelcontextprotocol/sdk/server/zod-compat.js";
import type {
  CallToolResult,
  ServerNotification,
  ServerRequest,
} from "@modelcontextprotocol/sdk/types.js";
import type { RequestHandlerExtra } from "@modelcontextprotocol/sdk/shared/protocol.js";

type ToolExtra = RequestHandlerExtra<ServerRequest, ServerNotification>;
type ToolInput<Schema extends ZodRawShapeCompat> = ShapeOutput<Schema>;
type AuthedToolMetadata<Schema extends ZodRawShapeCompat> = {
  title: string;
  description: string;
  inputSchema: Schema;
  admin?: boolean;
};
type AuthedToolHandler<Schema extends ZodRawShapeCompat> = (
  input: ToolInput<Schema>,
  auth: AuthContext,
  extra: ToolExtra,
) => CallToolResult | Promise<CallToolResult>;

const uuid = z.string().uuid();

function authFromExtra(extra: ToolExtra): AuthContext {
  const auth = extra.authInfo?.extra as Partial<AuthContext> | undefined;
  if (
    auth?.type !== "api_key" ||
    !auth.userId ||
    (auth.role !== "admin" && auth.role !== "agent")
  ) {
    throw ApiError.unauthorized();
  }
  return {
    type: "api_key",
    userId: auth.userId,
    role: auth.role,
    apiKeyId: typeof auth.apiKeyId === "string" ? auth.apiKeyId : undefined,
  };
}

function toolResult(data: unknown): CallToolResult {
  const structuredContent =
    data && typeof data === "object" && !Array.isArray(data)
      ? (data as Record<string, unknown>)
      : { result: data };

  return {
    structuredContent,
    content: [
      {
        type: "text" as const,
        text: JSON.stringify(data, null, 2),
      },
    ],
  };
}

function registerAuthedTool<Schema extends ZodRawShapeCompat>(
  server: McpServer,
  name: string,
  metadata: AuthedToolMetadata<Schema>,
  handler: AuthedToolHandler<Schema>,
) {
  const { admin, ...toolMetadata } = metadata;

  const callback = (async (input: ToolInput<Schema>, extra: ToolExtra) => {
    const auth = authFromExtra(extra);
    if (admin) requireAdmin(auth);
    return handler(input, auth, extra);
  }) as ToolCallback<Schema>;

  server.registerTool(name, toolMetadata, callback);
}

function paramsFrom(input: Record<string, unknown>) {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(input)) {
    if (value === undefined || value === null || value === "") continue;
    if (key === "custom_fields" && typeof value === "object" && !Array.isArray(value)) {
      for (const [fieldKey, fieldValue] of Object.entries(value)) {
        if (fieldValue !== undefined && fieldValue !== null && fieldValue !== "") {
          params.set(`custom_fields.${fieldKey}`, String(fieldValue));
        }
      }
      continue;
    }
    params.set(key, String(value));
  }
  return params;
}

const paginationInput = {
  page: z.number().int().min(1).optional(),
  per_page: z.number().int().min(1).max(100).optional(),
};

export function registerTicqexTools(server: McpServer) {
  registerAuthedTool(
    server,
    "ticqex_get_me",
    {
      title: "Get Current User",
      description: "Return the Ticqex user associated with the API key.",
      inputSchema: {},
    },
    async (_input, auth) => toolResult(await getMe(auth.userId)),
  );

  registerAuthedTool(
    server,
    "ticqex_list_users",
    {
      title: "List Users",
      description: "List staff users available for assignment.",
      inputSchema: {},
    },
    async () => toolResult(await listUsers()),
  );

  registerAuthedTool(
    server,
    "ticqex_list_tickets",
    {
      title: "List Tickets",
      description: "List tickets using the same filters as GET /api/v1/tickets.",
      inputSchema: {
        ...paginationInput,
        status_id: uuid.optional(),
        assignee_id: uuid.optional(),
        customer_id: uuid.optional(),
        origin: z.string().optional(),
        kind: z.string().optional(),
        channel: z.string().optional(),
        tag: z.string().optional(),
        custom_fields: z.record(z.string(), z.string()).optional(),
      },
    },
    async (input) => toolResult(await listTickets(paramsFrom(input), { filters: {} })),
  );

  registerAuthedTool(
    server,
    "ticqex_create_ticket",
    {
      title: "Create Ticket",
      description: "Create a manual task ticket.",
      inputSchema: createTicketSchema.shape,
    },
    async (input, auth) => toolResult(await createTicket(parseBody(createTicketSchema, input), auth)),
  );

  registerAuthedTool(
    server,
    "ticqex_get_ticket",
    {
      title: "Get Ticket",
      description: "Get a ticket with messages when the ticket has a message thread.",
      inputSchema: { id: uuid },
    },
    async ({ id }, auth) => toolResult(await getTicket(id, auth.userId)),
  );

  registerAuthedTool(
    server,
    "ticqex_get_ticket_summary",
    {
      title: "Get Ticket Summary",
      description: "Get a ticket summary without loading the full message thread.",
      inputSchema: { id: uuid },
    },
    async ({ id }, auth) => toolResult(await getTicketSummary(id, auth.userId)),
  );

  registerAuthedTool(
    server,
    "ticqex_get_ticket_context",
    {
      title: "Get Ticket Context",
      description: "Get a markdown context export for a ticket.",
      inputSchema: { id: uuid },
    },
    async ({ id }) => toolResult({ markdown: await getTicketContext(id) }),
  );

  registerAuthedTool(
    server,
    "ticqex_update_ticket",
    {
      title: "Update Ticket",
      description: "Update ticket fields, tags, and custom fields.",
      inputSchema: { id: uuid, patch: updateTicketSchema },
    },
    async ({ id, patch }, auth) =>
      toolResult(
        await updateTicket(id, parseBody(updateTicketSchema, patch), {
          userId: auth.userId,
        }),
      ),
  );

  registerAuthedTool(
    server,
    "ticqex_delete_ticket",
    {
      title: "Delete Ticket",
      description: "Delete a ticket.",
      inputSchema: { id: uuid },
    },
    async ({ id }) => {
      await deleteTicket(id);
      return toolResult({ deleted: true });
    },
  );

  registerAuthedTool(
    server,
    "ticqex_list_ticket_messages",
    {
      title: "List Ticket Messages",
      description: "List public messages for a ticket.",
      inputSchema: { ticket_id: uuid },
    },
    async ({ ticket_id }, auth) =>
      toolResult(await listEnrichedMessages(ticket_id, auth.userId)),
  );

  registerAuthedTool(
    server,
    "ticqex_create_ticket_message",
    {
      title: "Create Ticket Message",
      description: "Create an agent reply on a ticket and enqueue outbound email when applicable.",
      inputSchema: { ticket_id: uuid, message: messageInputSchema },
    },
    async ({ ticket_id, message }, auth) => {
      const body = parseBody(messageInputSchema, message);
      const { message: created, shouldSendEmail } = await createAgentReply(
        ticket_id,
        { body: body.body, channel: body.channel ?? "admin", email: body.email },
        auth,
      );
      if (shouldSendEmail) {
        if (!isChannelOperational("email")) {
          throw ApiError.serviceUnavailable(
            "Email channel is disabled or integration is not configured",
          );
        }
        enqueueChannelOutbound("email", created.id);
      }
      return toolResult(created);
    },
  );

  registerAuthedTool(
    server,
    "ticqex_mark_ticket_read",
    {
      title: "Mark Ticket Read",
      description: "Mark customer messages on a ticket as read for the API-key user.",
      inputSchema: { ticket_id: uuid },
    },
    async ({ ticket_id }, auth) =>
      toolResult(await markTicketMessagesRead(ticket_id, auth.userId)),
  );

  registerAuthedTool(
    server,
    "ticqex_set_message_read",
    {
      title: "Set Message Read State",
      description: "Set a customer message read state for the API-key user.",
      inputSchema: { ticket_id: uuid, message_id: uuid, read: z.boolean().optional() },
    },
    async ({ ticket_id, message_id, read }, auth) => {
      const body = parseBody(toggleMessageReadSchema, { read });
      const result = await setMessageReadState(message_id, auth.userId, body.read);
      if (result.ticket_id !== ticket_id) throw ApiError.notFound("Message not found on this ticket");
      return toolResult(result);
    },
  );

  registerAuthedTool(
    server,
    "ticqex_get_attachment_url",
    {
      title: "Get Attachment URL",
      description: "Create a signed URL for a message attachment.",
      inputSchema: {
        message_id: uuid,
        attachment_id: uuid,
        force_download: z.boolean().optional(),
      },
    },
    async ({ message_id, attachment_id, force_download }) =>
      toolResult({
        url: await getAttachmentSignedUrl(message_id, attachment_id, {
          forceDownload: force_download,
        }),
      }),
  );

  registerAuthedTool(
    server,
    "ticqex_get_board",
    {
      title: "Get Board",
      description: "Get the kanban board using optional serialized filter, sort, and search values.",
      inputSchema: {
        filter: z.string().optional(),
        sort: z.string().optional(),
        q: z.string().optional(),
      },
    },
    async ({ filter, sort, q }, auth) =>
      toolResult(
        await getBoard(
          auth.userId,
          parseTicketFilterParam(filter ?? null),
          parseBoardSortParam(sort ?? null),
          q ?? "",
        ),
      ),
  );

  registerAuthedTool(
    server,
    "ticqex_get_board_filter_options",
    {
      title: "Get Board Filter Options",
      description: "List customers, assignees, and tags that appear on the visible board.",
      inputSchema: {},
    },
    async () => toolResult(await getBoardFilterOptions()),
  );

  registerAuthedTool(
    server,
    "ticqex_get_board_lane_tickets",
    {
      title: "Get Board Lane Tickets",
      description: "Load a page of tickets for one board lane.",
      inputSchema: {
        status_id: uuid,
        offset: z.number().int().min(0),
        limit: z.number().int().min(1).max(100).optional(),
        filter: z.string().optional(),
        sort: z.string().optional(),
      },
    },
    async ({ status_id, offset, limit, filter, sort }, auth) =>
      toolResult(
        await getLaneTicketsPage(
          status_id,
          offset,
          limit ?? 25,
          auth.userId,
          parseTicketFilterParam(filter ?? null),
          parseBoardSortParam(sort ?? null),
        ),
      ),
  );

  registerAuthedTool(
    server,
    "ticqex_set_board_lane_order",
    {
      title: "Set Board Lane Order",
      description: "Persist the current user's manual order for a board lane.",
      inputSchema: { status_id: uuid, order: boardLaneOrderSchema },
    },
    async ({ status_id, order }, auth) => {
      const body = parseBody(boardLaneOrderSchema, order);
      const ticketIds = await setLaneOrder(
        auth.userId,
        status_id,
        body.ticket_ids,
        body.visible_ticket_ids?.length
          ? {
              visibleTicketIds: body.visible_ticket_ids,
              removedTicketIds: body.removed_ticket_ids,
            }
          : undefined,
      );
      return toolResult({ status_id, ticket_ids: ticketIds });
    },
  );

  registerAuthedTool(
    server,
    "ticqex_seed_manual_board_orders",
    {
      title: "Seed Manual Board Orders",
      description: "Persist multiple manual board lane orders for the current user.",
      inputSchema: seedManualLaneOrdersSchema.shape,
    },
    async (input, auth) => {
      const body = parseBody(seedManualLaneOrdersSchema, input);
      const lanes = await seedManualLaneOrders(auth.userId, body.lanes, {
        onlyIfEmpty: body.only_if_empty,
        mergeVisible: body.merge_visible,
      });
      return toolResult({ lanes });
    },
  );

  registerAuthedTool(
    server,
    "ticqex_move_ticket_on_board",
    {
      title: "Move Ticket On Board",
      description: "Move/reorder a ticket on the board and persist lane ordering.",
      inputSchema: boardMoveTicketSchema.shape,
    },
    async (input, auth) =>
      toolResult(
        await moveTicketOnBoard(
          auth.userId,
          parseBody(boardMoveTicketSchema, input),
        ),
      ),
  );

  registerAuthedTool(
    server,
    "ticqex_list_customers",
    {
      title: "List Customers",
      description: "List customers.",
      inputSchema: paginationInput,
    },
    async (input) => toolResult(await listCustomers(paramsFrom(input))),
  );

  registerAuthedTool(
    server,
    "ticqex_get_customer",
    {
      title: "Get Customer",
      description: "Get a customer with ticket count and custom fields.",
      inputSchema: { id: uuid },
    },
    async ({ id }) => toolResult(await getCustomer(id)),
  );

  registerAuthedTool(
    server,
    "ticqex_create_customer",
    {
      title: "Create Customer",
      description: "Create a customer.",
      inputSchema: createCustomerSchema.shape,
    },
    async (input) => toolResult(await createCustomer(parseBody(createCustomerSchema, input))),
  );

  registerAuthedTool(
    server,
    "ticqex_update_customer",
    {
      title: "Update Customer",
      description: "Update a customer.",
      inputSchema: { id: uuid, patch: updateCustomerSchema },
    },
    async ({ id, patch }) =>
      toolResult(await updateCustomer(id, parseBody(updateCustomerSchema, patch))),
  );

  registerAuthedTool(
    server,
    "ticqex_delete_customer",
    {
      title: "Delete Customer",
      description: "Delete a customer with no existing tickets.",
      inputSchema: { id: uuid },
    },
    async ({ id }) => {
      await deleteCustomer(id);
      return toolResult({ deleted: true });
    },
  );

  registerAuthedTool(
    server,
    "ticqex_list_statuses",
    {
      title: "List Statuses",
      description: "List board statuses.",
      inputSchema: {},
    },
    async () => toolResult(await listStatuses()),
  );

  registerAuthedTool(
    server,
    "ticqex_create_status",
    {
      title: "Create Status",
      description: "Create a board status. Admin only.",
      inputSchema: createStatusSchema.shape,
      admin: true,
    },
    async (input) => toolResult(await createStatus(parseBody(createStatusSchema, input))),
  );

  registerAuthedTool(
    server,
    "ticqex_update_status",
    {
      title: "Update Status",
      description: "Update a board status. Admin only.",
      inputSchema: { id: uuid, patch: updateStatusSchema },
      admin: true,
    },
    async ({ id, patch }) =>
      toolResult(await updateStatus(id, parseBody(updateStatusSchema, patch))),
  );

  registerAuthedTool(
    server,
    "ticqex_delete_status",
    {
      title: "Delete Status",
      description: "Delete a board status, optionally reassigning tickets. Admin only.",
      inputSchema: { id: uuid, options: deleteStatusSchema.optional() },
      admin: true,
    },
    async ({ id, options }) => {
      const body = parseBody(deleteStatusSchema, options ?? {});
      await deleteStatus(id, body.reassign_to);
      return toolResult({ deleted: true });
    },
  );

  registerAuthedTool(
    server,
    "ticqex_reorder_statuses",
    {
      title: "Reorder Statuses",
      description: "Replace board status order. Admin only.",
      inputSchema: reorderStatusesSchema.shape,
      admin: true,
    },
    async (input) =>
      toolResult(await reorderStatuses(parseBody(reorderStatusesSchema, input).ids)),
  );

  registerAuthedTool(
    server,
    "ticqex_list_tags",
    {
      title: "List Tags",
      description: "List tags.",
      inputSchema: {},
    },
    async () => toolResult(await listTags()),
  );

  registerAuthedTool(
    server,
    "ticqex_create_tag",
    {
      title: "Create Tag",
      description: "Create a tag. Admin only.",
      inputSchema: createTagSchema.shape,
      admin: true,
    },
    async (input) => toolResult(await createTag(parseBody(createTagSchema, input))),
  );

  registerAuthedTool(
    server,
    "ticqex_update_tag",
    {
      title: "Update Tag",
      description: "Update a tag. Admin only.",
      inputSchema: { id: uuid, patch: updateTagSchema },
      admin: true,
    },
    async ({ id, patch }) =>
      toolResult(await updateTag(id, parseBody(updateTagSchema, patch))),
  );

  registerAuthedTool(
    server,
    "ticqex_delete_tag",
    {
      title: "Delete Tag",
      description: "Delete a tag. Admin only.",
      inputSchema: { id: uuid },
      admin: true,
    },
    async ({ id }) => {
      await deleteTag(id);
      return toolResult({ deleted: true });
    },
  );

  registerAuthedTool(
    server,
    "ticqex_list_custom_fields",
    {
      title: "List Custom Fields",
      description: "List custom field definitions.",
      inputSchema: { group: z.enum(["ticket", "customer"]).optional() },
    },
    async ({ group }) => toolResult(await listDefinitions(createAdminClient(), group)),
  );

  registerAuthedTool(
    server,
    "ticqex_create_custom_field",
    {
      title: "Create Custom Field",
      description: "Create a custom field definition. Admin only.",
      inputSchema: createCustomFieldSchema.shape,
      admin: true,
    },
    async (input) =>
      toolResult(
        await createDefinition(createAdminClient(), parseBody(createCustomFieldSchema, input)),
      ),
  );

  registerAuthedTool(
    server,
    "ticqex_update_custom_field",
    {
      title: "Update Custom Field",
      description: "Update a custom field definition. Admin only.",
      inputSchema: { id: uuid, patch: updateCustomFieldSchema },
      admin: true,
    },
    async ({ id, patch }) =>
      toolResult(
        await updateDefinition(createAdminClient(), id, parseBody(updateCustomFieldSchema, patch)),
      ),
  );

  registerAuthedTool(
    server,
    "ticqex_delete_custom_field",
    {
      title: "Delete Custom Field",
      description: "Delete a custom field definition. Admin only.",
      inputSchema: { id: uuid },
      admin: true,
    },
    async ({ id }) => {
      await deleteDefinition(createAdminClient(), id);
      return toolResult({ deleted: true });
    },
  );

  registerAuthedTool(
    server,
    "ticqex_get_settings",
    {
      title: "Get Settings",
      description: "Get global settings and configured channel availability.",
      inputSchema: {},
    },
    async () =>
      toolResult({
        ...(await getSettings()),
        channels: loadTicqexConfig().channels,
      }),
  );

  registerAuthedTool(
    server,
    "ticqex_patch_settings",
    {
      title: "Patch Settings",
      description: "Update global settings. Admin only.",
      inputSchema: patchSettingsSchema.shape,
      admin: true,
    },
    async (input) => toolResult(await patchSettings(parseBody(patchSettingsSchema, input))),
  );

  registerAuthedTool(
    server,
    "ticqex_list_email_snippets",
    {
      title: "List Email Snippets",
      description: "List email snippets.",
      inputSchema: {},
    },
    async () => toolResult(await listEmailSnippets()),
  );

  registerAuthedTool(
    server,
    "ticqex_create_email_snippet",
    {
      title: "Create Email Snippet",
      description: "Create an email snippet. Admin only.",
      inputSchema: createEmailSnippetSchema.shape,
      admin: true,
    },
    async (input, auth) => {
      const body = parseBody(createEmailSnippetSchema, input);
      return toolResult(
        await createEmailSnippet({
          title: body.title,
          body: body.body,
          createdBy: auth.userId,
        }),
      );
    },
  );

  registerAuthedTool(
    server,
    "ticqex_delete_email_snippet",
    {
      title: "Delete Email Snippet",
      description: "Delete an email snippet. Admin only.",
      inputSchema: { id: uuid },
      admin: true,
    },
    async ({ id }) => {
      await deleteEmailSnippet(id);
      return toolResult({ deleted: true });
    },
  );
}
