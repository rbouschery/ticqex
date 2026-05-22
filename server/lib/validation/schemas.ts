import { z } from "zod";
import { ApiError } from "@server/lib/errors";

const emailAddressSchema = z.string().email();

export const emailComposeOptionsSchema = z.object({
  cc: z.array(emailAddressSchema).optional(),
  subject: z.string().optional(),
  reply_all: z.boolean().optional(),
  include_quote: z.boolean().optional(),
  attachment_upload_ids: z.array(z.string().uuid()).optional(),
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
  customer: z
    .object({ username: z.string() })
    .optional()
    .transform((c) => {
      const username = c?.username?.trim();
      return username ? { username } : undefined;
    }),
});

/** Conversations are created by inbound email only, not via API. */
export const createTicketSchema = createTaskTicketSchema;

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

export const createCustomerSchema = z.object({
  username: z.string().min(1),
  custom_fields: z.record(z.string(), z.unknown()).optional(),
});

export const updateCustomerSchema = z.object({
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

export const createTagSchema = z.object({
  name: z.string().min(1),
  color: z.string().optional(),
});

export const updateTagSchema = z.object({
  name: z.string().min(1).optional(),
  color: z.string().optional(),
});

export const createCustomFieldSchema = z.object({
  group: z.enum(["ticket", "customer"]),
  key: z.string().min(1).regex(/^[a-z][a-z0-9_]*$/),
  label: z.string().min(1),
  type: z.enum(["text", "number", "date", "boolean", "select", "url", "json"]),
  options: z.record(z.string(), z.unknown()).optional(),
  required: z.boolean().optional(),
  position: z.number().int().optional(),
});

export const updateCustomFieldSchema = createCustomFieldSchema.partial().omit({
  group: true,
  key: true,
});

export const patchSettingsSchema = z.object({
  visible_status_ids: z.array(z.string().uuid()).optional(),
  default_inbound_status_id: z.string().uuid().nullable().optional(),
  show_customer_on_ticket: z.boolean().optional(),
  show_assignee_on_ticket: z.boolean().optional(),
  show_body_on_ticket: z.boolean().optional(),
  visible_ticket_field_ids: z.array(z.string().uuid()).optional(),
  visible_customer_field_ids: z.array(z.string().uuid()).optional(),
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
