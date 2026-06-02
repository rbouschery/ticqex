import { describe } from "vitest";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { createAdminClient } from "@server/lib/supabase-admin";
import {
  LOADTEST_TITLE_PREFIX,
  NEEDLE_SECRET,
  NEEDLE_TITLE,
} from "@shared/board-load-test";
import { perLaneTicketLimit } from "@shared/board-limits";

export const SEED_ADMIN_EMAIL =
  process.env.SEED_ADMIN_EMAIL ?? "admin@ticqex.local";
export const SEED_ADMIN_PASSWORD =
  process.env.SEED_ADMIN_PASSWORD ?? "ticqex-admin-change-me";

export function requireSupabaseEnv(): boolean {
  return Boolean(
    process.env.NEXT_PUBLIC_SUPABASE_URL &&
      process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY &&
      process.env.SUPABASE_SECRET_KEY,
  );
}

export const describeIntegration = describe.skipIf(!requireSupabaseEnv());

export type SeedAdminSession = {
  token: string;
  userId: string;
  supabase: SupabaseClient;
};

export async function signInAsSeedAdmin(): Promise<SeedAdminSession> {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const publishableKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!;
  const supabase = createClient(url, publishableKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  const { data: auth, error } = await supabase.auth.signInWithPassword({
    email: SEED_ADMIN_EMAIL,
    password: SEED_ADMIN_PASSWORD,
  });
  if (error || !auth.session) {
    throw new Error(`Sign in failed: ${error?.message ?? "no session"}`);
  }

  return {
    token: auth.session.access_token,
    userId: auth.user!.id,
    supabase,
  };
}

export function adminDb() {
  return createAdminClient();
}

export function staffAuth(userId: string) {
  return { type: "staff" as const, userId, role: "admin" as const };
}

export async function getFirstStatusId(db = adminDb()): Promise<string> {
  const { data: status, error } = await db
    .from("status_types")
    .select("id")
    .order("position")
    .limit(1)
    .single();
  if (error || !status) throw new Error(error?.message ?? "No status found");
  return status.id as string;
}

export async function getFirstCustomerId(db = adminDb()): Promise<string> {
  const { data: customer, error } = await db
    .from("customers")
    .select("id")
    .limit(1)
    .single();
  if (error || !customer) throw new Error(error?.message ?? "No customer found");
  return customer.id as string;
}

export type MinimalTicketInput = {
  title: string;
  kind?: "task" | "conversation";
  status_id?: string;
  customer_id?: string | null;
  assignee_id?: string | null;
  channel?: string | null;
  contact_address?: string | null;
  body?: string | null;
  origin?: string;
};

export async function insertMinimalTicket(
  input: MinimalTicketInput,
  db = adminDb(),
): Promise<{ id: string }> {
  const statusId = input.status_id ?? (await getFirstStatusId(db));
  const { data: ticket, error } = await db
    .from("tickets")
    .insert({
      title: input.title,
      kind: input.kind ?? "task",
      status_id: statusId,
      customer_id: input.customer_id ?? null,
      assignee_id: input.assignee_id ?? null,
      channel: input.channel ?? null,
      contact_address: input.contact_address ?? null,
      body: input.body ?? null,
      origin: input.origin ?? "manual",
    })
    .select("id")
    .single();
  if (error || !ticket) {
    throw new Error(error?.message ?? "ticket insert failed");
  }
  return { id: ticket.id as string };
}

export async function insertCustomerMessage(
  ticketId: string,
  body: string,
  db = adminDb(),
): Promise<{ id: string }> {
  const { data: message, error } = await db
    .from("messages")
    .insert({
      ticket_id: ticketId,
      body,
      visibility: "public",
      author_type: "customer",
      channel: "email",
    })
    .select("id")
    .single();
  if (error || !message) {
    throw new Error(error?.message ?? "message insert failed");
  }
  return { id: message.id as string };
}

/** Enough tickets in one lane to trigger board browse cap (no seed:board-load). */
export async function seedMinimalBoardLoad(db = adminDb()): Promise<{
  ticketIds: string[];
  needleId: string;
  needleTitle: string;
  cleanup: () => Promise<void>;
}> {
  const { data: statuses, error: statusErr } = await db
    .from("status_types")
    .select("id, name")
    .order("position");
  if (statusErr || !statuses?.length) {
    throw new Error(statusErr?.message ?? "No statuses found");
  }

  const customerId = await getFirstCustomerId(db);
  const laneCount = statuses.filter(() => true).length;
  const perLane = perLaneTicketLimit(laneCount);
  const bulkCount = perLane + 50;
  const statusId = statuses[0]!.id as string;
  const runId = Date.now();
  const ticketIds: string[] = [];
  const baseTime = Date.parse("2024-06-01T00:00:00.000Z") + runId;

  const batchSize = 100;
  for (let offset = 0; offset < bulkCount; offset += batchSize) {
    const batch = [];
    for (let i = offset; i < Math.min(offset + batchSize, bulkCount); i++) {
      const updated_at = new Date(baseTime + i * 60_000).toISOString();
      batch.push({
        title: `${LOADTEST_TITLE_PREFIX} vitest ${runId} ${String(i + 1).padStart(4, "0")}`,
        kind: "task" as const,
        body: `Synthetic cap test ticket ${i + 1}.`,
        status_id: statusId,
        origin: "manual" as const,
        updated_at,
        created_at: updated_at,
      });
    }
    const { data, error } = await db.from("tickets").insert(batch).select("id");
    if (error) throw new Error(error.message);
    ticketIds.push(...(data ?? []).map((row) => row.id as string));
  }

  // Oldest ticket in the overcrowded lane — excluded from capped browse, findable via search.
  const needleUpdatedAt = new Date(baseTime).toISOString();

  const needleTitle = `${NEEDLE_TITLE} ${runId}`;
  const { data: needle, error: needleErr } = await db
    .from("tickets")
    .insert({
      title: needleTitle,
      kind: "conversation",
      channel: "email",
      contact_address: `needle-${runId}@example.com`,
      customer_id: customerId,
      status_id: statusId,
      origin: "manual",
      updated_at: needleUpdatedAt,
      created_at: needleUpdatedAt,
    })
    .select("id")
    .single();
  if (needleErr || !needle) {
    throw new Error(needleErr?.message ?? "needle insert failed");
  }

  const { error: msgErr } = await db.from("messages").insert({
    ticket_id: needle.id,
    body: `Customer follow-up with hidden keyword ${NEEDLE_SECRET} buried in the thread.`,
    visibility: "public",
    author_type: "customer",
    channel: "admin",
  });
  if (msgErr) throw new Error(msgErr.message);

  const needleId = needle.id as string;
  ticketIds.push(needleId);

  return {
    ticketIds,
    needleId,
    needleTitle,
    cleanup: async () => {
      for (let i = 0; i < ticketIds.length; i += batchSize) {
        const chunk = ticketIds.slice(i, i + batchSize);
        await db.from("tickets").delete().in("id", chunk);
      }
    },
  };
}

export { LOADTEST_TITLE_PREFIX, NEEDLE_SECRET, NEEDLE_TITLE };
