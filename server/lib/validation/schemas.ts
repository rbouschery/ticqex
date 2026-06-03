import { z } from "zod";
import { ApiError } from "@server/lib/errors";
import {
  CUSTOM_FIELD_TYPES,
  validateDefinitionOptions,
} from "@shared/custom-fields";

const emailAddressSchema = z.string().email();

export const emailComposeOptionsSchema = z.object({
  cc: z.array(emailAddressSchema).optional(),
  subject: z.string().optional(),
  reply_all: z.boolean().optional(),
  include_quote: z.boolean().optional(),
  attachment_upload_ids: z.array(z.string().uuid()).optional(),
});

export const sendDraftSchema = z.object({
  include_quote: z.boolean().optional(),
  reply_all: z.boolean().optional(),
});

export const messageInputSchema = z.object({
  body: z.string().min(1),
  channel: z.enum(["email", "api", "admin"]).optional(),
  email: emailComposeOptionsSchema.optional(),
});

const ticketBaseSchema = z.object({
  title: z.string().trim().min(1),
  status_id: z.string().uuid().optional(),
  assignee_id: z.string().uuid().nullable().optional(),
  origin: z.enum(["manual", "api", "email"]).optional(),
  tags: z.array(z.string()).optional(),
  custom_fields: z.record(z.string(), z.unknown()).optional(),
});

export const createTaskTicketSchema = ticketBaseSchema.extend({
  kind: z.literal("task"),
  body: z.string().optional(),
  contact: z
    .object({ username: z.string() })
    .optional()
    .transform((c) => {
      const username = c?.username?.trim();
      return username ? { username } : undefined;
    }),
});

export const createConversationTicketSchema = z.object({
  kind: z.literal("conversation"),
  title: z.string().trim().min(1),
  contact_address: z.string().email(),
  message: z.object({ body: z.string().min(1) }),
  status_id: z.string().uuid().optional(),
  assignee_id: z.string().uuid().nullable().optional(),
  tags: z.array(z.string()).optional(),
  custom_fields: z.record(z.string(), z.unknown()).optional(),
});

export const createTicketSchema = z.discriminatedUnion("kind", [
  createTaskTicketSchema,
  createConversationTicketSchema,
]);

export const createTicketMcpInputSchema = z
  .object({
    ...ticketBaseSchema.shape,
    kind: z.enum(["task", "conversation"]),
    body: z.string().optional(),
    contact: z
      .object({ username: z.string() })
      .optional()
      .transform((c) => {
        const username = c?.username?.trim();
        return username ? { username } : undefined;
      }),
    contact_address: z.string().email().optional(),
    message: z.object({ body: z.string().min(1).optional() }).optional(),
  })
  .superRefine((data, ctx) => {
    if (data.kind !== "conversation") return;

    if (!data.contact_address) {
      ctx.addIssue({
        code: "custom",
        message: "contact_address is required for conversation tickets",
        path: ["contact_address"],
      });
    }

    if (!data.message?.body) {
      ctx.addIssue({
        code: "custom",
        message: "message.body is required for conversation tickets",
        path: ["message", "body"],
      });
    }
  });

export const updateTicketSchema = z.object({
  title: z.string().min(1).optional(),
  body: z.string().nullable().optional(),
  status_id: z.string().uuid().optional(),
  assignee_id: z.string().uuid().nullable().optional(),
  tags: z.array(z.string()).optional(),
  custom_fields: z.record(z.string(), z.unknown()).optional(),
});

export const toggleMessageReadSchema = z.object({
  read: z.boolean().optional(),
});

export const createEmailSnippetSchema = z.object({
  title: z.string().min(1),
  body: z.string().min(1),
});

export const createContactSchema = z.object({
  username: z.string().min(1),
  custom_fields: z.record(z.string(), z.unknown()).optional(),
});

export const updateContactSchema = z.object({
  username: z.string().min(1).optional(),
  custom_fields: z.record(z.string(), z.unknown()).optional(),
});

export const createStatusSchema = z.object({
  name: z.string().min(1),
  color: z.string().optional(),
  position: z.number().int().optional(),
  is_visible: z.boolean().optional(),
});

export const updateStatusSchema = z.object({
  name: z.string().min(1).optional(),
  color: z.string().optional(),
  position: z.number().int().optional(),
  is_visible: z.boolean().optional(),
});

export const deleteStatusSchema = z.object({
  reassign_to: z.string().uuid().optional(),
});

export const reorderStatusesSchema = z.object({
  ids: z.array(z.string().uuid()).min(1),
});

export const boardLaneOrderSchema = z.object({
  ticket_ids: z.array(z.string().uuid()),
  visible_ticket_ids: z.array(z.string().uuid()).optional(),
  removed_ticket_ids: z.array(z.string().uuid()).optional(),
});

export const seedManualLaneOrdersSchema = z.object({
  lanes: z.record(z.string().uuid(), z.array(z.string().uuid())),
  only_if_empty: z.boolean().optional(),
  merge_visible: z.boolean().optional(),
});

const boardMoveFilterContextSchema = z.object({
  source_visible_ticket_ids: z.array(z.string().uuid()).optional(),
  target_visible_ticket_ids: z.array(z.string().uuid()).optional(),
  removed_ticket_ids: z.array(z.string().uuid()).optional(),
});

export const boardMoveTicketSchema = z
  .object({
    ticket_id: z.string().uuid(),
    from_status_id: z.string().uuid(),
    to_status_id: z.string().uuid(),
    target_ticket_ids: z.array(z.string().uuid()),
    source_ticket_ids: z.array(z.string().uuid()).optional(),
    filter_context: boardMoveFilterContextSchema.optional(),
  })
  .superRefine((data, ctx) => {
    if (
      data.from_status_id !== data.to_status_id &&
      data.source_ticket_ids === undefined
    ) {
      ctx.addIssue({
        code: "custom",
        message: "source_ticket_ids is required when moving across lanes",
        path: ["source_ticket_ids"],
      });
    }
  });

export const createTagSchema = z.object({
  name: z.string().min(1),
  color: z.string().optional(),
});

export const updateTagSchema = z.object({
  name: z.string().min(1).optional(),
  color: z.string().optional(),
});

const customFieldDefinitionFieldsSchema = z.object({
  label: z.string().min(1),
  type: z.enum(CUSTOM_FIELD_TYPES),
  options: z.record(z.string(), z.unknown()).nullable().optional(),
  required: z.boolean().optional(),
  position: z.number().int().optional(),
});

export const createCustomFieldSchema = customFieldDefinitionFieldsSchema
  .extend({
    group: z.enum(["ticket", "contact"]),
    key: z.string().min(1).regex(/^[a-z][a-z0-9_]*$/),
  })
  .superRefine((data, ctx) => {
    const message = validateDefinitionOptions(data.type, data.options ?? null);
    if (message) {
      ctx.addIssue({ code: "custom", message, path: ["options"] });
    }
  });

export const updateCustomFieldSchema = customFieldDefinitionFieldsSchema.partial();

export const reorderCustomFieldsSchema = z.object({
  group: z.enum(["ticket", "contact"]),
  ids: z.array(z.string().uuid()).min(1),
});

const ticketFieldVisibilityEntrySchema = z.object({
  showOnCard: z.boolean(),
  showInTicket: z.boolean(),
});

export const ticketFieldVisibilitySchema = z.record(
  z.string(),
  ticketFieldVisibilityEntrySchema,
);

export const patchSettingsSchema = z.object({
  visible_status_ids: z.array(z.string().uuid()).optional(),
  default_inbound_status_id: z.string().uuid().nullable().optional(),
  ticket_field_visibility: ticketFieldVisibilitySchema.optional(),
  email_signature: z.string().optional(),
  email_thread_order: z.enum(["oldest_first", "newest_first"]).optional(),
});

export const createApiKeySchema = z.object({
  name: z.string().min(1),
});

export function parseBody<T>(schema: z.ZodType<T>, body: unknown): T {
  const result = schema.safeParse(body);
  if (!result.success) {
    const msg = result.error.issues.map((i) => i.message).join("; ");
    throw ApiError.badRequest(msg || "Invalid request body");
  }
  return result.data;
}
