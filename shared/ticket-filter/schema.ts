import { z } from "zod";

export const FILTER_OPERATORS = [
  "eq",
  "neq",
  "in",
  "nin",
  "empty",
  "not_empty",
  "contains",
  "not_contains",
] as const;

export type FilterOperator = (typeof FILTER_OPERATORS)[number];

export const SCALAR_FILTER_FIELDS = [
  "assignee_id",
  "customer_id",
  "kind",
  "channel",
  "origin",
] as const;

export type ScalarFilterField = (typeof SCALAR_FILTER_FIELDS)[number];

const uuidSchema = z.string().uuid();
const kindValueSchema = z.enum(["task", "conversation"]);
const originValueSchema = z.enum(["manual", "api", "email"]);

const scalarConditionSchema = z
  .object({
    field: z.enum(SCALAR_FILTER_FIELDS),
    op: z.enum(["eq", "neq", "in", "nin", "empty", "not_empty"]),
    value: z.string().optional(),
    values: z.array(z.string()).optional(),
  })
  .superRefine((data, ctx) => {
    if (data.op === "empty" || data.op === "not_empty") return;
    if (data.op === "eq" || data.op === "neq") {
      if (!data.value) {
        ctx.addIssue({ code: "custom", message: "value is required" });
        return;
      }
      if (data.field === "assignee_id" || data.field === "customer_id") {
        if (!uuidSchema.safeParse(data.value).success) {
          ctx.addIssue({ code: "custom", message: "invalid uuid" });
        }
      }
      if (data.field === "kind" && !kindValueSchema.safeParse(data.value).success) {
        ctx.addIssue({ code: "custom", message: "invalid kind" });
      }
      if (data.field === "origin" && !originValueSchema.safeParse(data.value).success) {
        ctx.addIssue({ code: "custom", message: "invalid origin" });
      }
      return;
    }
    if (!data.values?.length) {
      ctx.addIssue({ code: "custom", message: "values are required" });
      return;
    }
    if (data.field === "assignee_id" || data.field === "customer_id") {
      for (const value of data.values) {
        if (!uuidSchema.safeParse(value).success) {
          ctx.addIssue({ code: "custom", message: "invalid uuid in values" });
        }
      }
    }
  });

const tagConditionSchema = z.object({
  field: z.literal("tag"),
  op: z.enum(["in", "nin", "any"]),
  values: z.array(z.string().min(1)).min(1),
});

const unreadConditionSchema = z.object({
  field: z.literal("unread"),
  op: z.enum(["eq", "neq"]),
  value: z.boolean(),
});

const ticketFieldConditionSchema = z
  .object({
    field: z.literal("ticket_field"),
    key: z.string().min(1),
    op: z.enum([
      "eq",
      "neq",
      "in",
      "nin",
      "empty",
      "not_empty",
      "contains",
      "not_contains",
    ]),
    value: z.union([z.string(), z.boolean(), z.number()]).optional(),
    values: z.array(z.union([z.string(), z.number()])).optional(),
  })
  .superRefine((data, ctx) => {
    if (data.op === "empty" || data.op === "not_empty") return;
    if (data.op === "eq" || data.op === "neq" || data.op === "contains" || data.op === "not_contains") {
      if (data.value === undefined) {
        ctx.addIssue({ code: "custom", message: "value is required" });
      }
      return;
    }
    if (!data.values?.length) {
      ctx.addIssue({ code: "custom", message: "values are required" });
    }
  });

export const ticketFilterConditionSchema = z.union([
  scalarConditionSchema,
  tagConditionSchema,
  unreadConditionSchema,
  ticketFieldConditionSchema,
]);

export const ticketFilterSchema = z.array(ticketFilterConditionSchema);

export type TicketFilterCondition = z.infer<typeof ticketFilterConditionSchema>;
export type TicketFilter = z.infer<typeof ticketFilterSchema>;

export function normalizeCondition(condition: TicketFilterCondition): TicketFilterCondition {
  if (condition.field === "tag" && condition.op === "any") {
    return { ...condition, op: "in" };
  }
  return condition;
}

export function normalizeTicketFilter(filter: TicketFilter): TicketFilter {
  return filter.map((condition) => normalizeCondition(condition));
}

export function isTicketFilterActive(filter: TicketFilter): boolean {
  return filter.length > 0;
}

export function serializeTicketFilter(filter: TicketFilter): string {
  return JSON.stringify(filter);
}

export function upsertFilterCondition(
  filter: TicketFilter,
  condition: TicketFilter[number],
): TicketFilter {
  const conditionKey =
    condition.field === "ticket_field"
      ? `ticket_field:${condition.key}`
      : condition.field;

  const next = filter.filter((existing) => {
    const key =
      existing.field === "ticket_field"
        ? `ticket_field:${existing.key}`
        : existing.field;
    return key !== conditionKey;
  });

  return [...next, condition];
}

export function removeFilterCondition(
  filter: TicketFilter,
  index: number,
): TicketFilter {
  return filter.filter((_, i) => i !== index);
}
