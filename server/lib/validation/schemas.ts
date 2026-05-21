import { z } from "zod";
import { ApiError } from "@server/lib/errors";

export const messageInputSchema = z.object({
  body: z.string().min(1),
  visibility: z.enum(["public", "internal"]).default("public"),
  channel: z.enum(["email", "api", "admin"]).optional(),
});

export const toggleMessageReadSchema = z.object({
  read: z.boolean().optional(),
});

export const createTicketSchema = z.object({
  title: z.string().min(1),
  customer: z.object({ username: z.string().min(1) }),
  status_id: z.string().uuid().optional(),
  assignee_id: z.string().uuid().nullable().optional(),
  origin: z.enum(["manual", "api", "email"]).optional(),
  tags: z.array(z.string()).optional(),
  message: messageInputSchema.optional(),
  custom_fields: z.record(z.string(), z.unknown()).optional(),
});

export const updateTicketSchema = z.object({
  title: z.string().min(1).optional(),
  status_id: z.string().uuid().optional(),
  assignee_id: z.string().uuid().nullable().optional(),
  tags: z.array(z.string()).optional(),
  custom_fields: z.record(z.string(), z.unknown()).optional(),
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
});

export const updateStatusSchema = z.object({
  name: z.string().min(1).optional(),
  color: z.string().optional(),
  position: z.number().int().optional(),
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
  show_customer_on_ticket: z.boolean().optional(),
  show_assignee_on_ticket: z.boolean().optional(),
  show_body_on_ticket: z.boolean().optional(),
  visible_ticket_field_ids: z.array(z.string().uuid()).optional(),
  visible_customer_field_ids: z.array(z.string().uuid()).optional(),
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
