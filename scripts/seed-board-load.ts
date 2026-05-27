/**
 * Seeds ~1200 load-test tickets plus one needle-in-haystack conversation.
 * Run: pnpm seed:board-load
 * Reset prior load-test rows: pnpm seed:board-load -- --reset
 */
import "dotenv/config";
import { createClient } from "@supabase/supabase-js";

import {
  LOADTEST_TITLE_PREFIX,
  NEEDLE_SECRET,
  NEEDLE_TITLE,
} from "../shared/board-load-test";

const TOTAL_BULK = 1200;
const BATCH_SIZE = 100;

async function main() {
  const reset = process.argv.includes("--reset");
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL ?? process.env.SUPABASE_URL;
  const secretKey = process.env.SUPABASE_SECRET_KEY;

  if (!url || !secretKey) {
    console.error("Missing Supabase URL or SUPABASE_SECRET_KEY");
    process.exit(1);
  }

  const db = createClient(url, secretKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  if (reset) {
    const ids: string[] = [];
    const pageSize = 1000;
    for (let from = 0; ; from += pageSize) {
      const { data: existing, error } = await db
        .from("tickets")
        .select("id")
        .like("title", `${LOADTEST_TITLE_PREFIX}%`)
        .range(from, from + pageSize - 1);
      if (error) {
        console.error("Failed to list prior load-test tickets:", error.message);
        process.exit(1);
      }
      if (!existing?.length) break;
      ids.push(...existing.map((row) => row.id as string));
      if (existing.length < pageSize) break;
    }

    for (let i = 0; i < ids.length; i += BATCH_SIZE) {
      const chunk = ids.slice(i, i + BATCH_SIZE);
      const { error: deleteErr } = await db.from("tickets").delete().in("id", chunk);
      if (deleteErr) {
        console.error("Failed to delete prior load-test tickets:", deleteErr.message);
        process.exit(1);
      }
    }
    if (ids.length) console.log(`Removed ${ids.length} prior load-test tickets`);
  }

  const { data: statuses, error: statusErr } = await db
    .from("status_types")
    .select("id, name")
    .order("position");
  if (statusErr || !statuses?.length) {
    console.error("No statuses found:", statusErr?.message);
    process.exit(1);
  }

  const { data: customer, error: customerErr } = await db
    .from("customers")
    .select("id")
    .limit(1)
    .maybeSingle();
  if (customerErr || !customer) {
    console.error("Need at least one customer:", customerErr?.message);
    process.exit(1);
  }

  const statusIds = statuses.map((s) => s.id as string);
  const baseTime = Date.parse("2024-01-01T00:00:00.000Z");

  let inserted = 0;
  for (let offset = 0; offset < TOTAL_BULK; offset += BATCH_SIZE) {
    const batch = [];
    for (let i = offset; i < Math.min(offset + BATCH_SIZE, TOTAL_BULK); i++) {
      const status_id = statusIds[i % statusIds.length]!;
      const updated_at = new Date(baseTime + i * 60_000).toISOString();
      batch.push({
        title: `${LOADTEST_TITLE_PREFIX} Ticket ${String(i + 1).padStart(4, "0")}`,
        kind: "task" as const,
        body: `Synthetic load-test ticket ${i + 1}. Filler content for board cap testing.`,
        status_id,
        origin: "manual" as const,
        updated_at,
        created_at: updated_at,
      });
    }

    const { error } = await db.from("tickets").insert(batch);
    if (error) {
      console.error(`Insert batch at ${offset} failed:`, error.message);
      process.exit(1);
    }
    inserted += batch.length;
  }

  const doneStatus =
    statuses.find((s) => s.name === "Done")?.id ?? statusIds[0]!;
  const needleUpdatedAt = new Date(baseTime + 60_000).toISOString();

  const { data: needle, error: needleErr } = await db
    .from("tickets")
    .insert({
      title: NEEDLE_TITLE,
      kind: "conversation",
      channel: "email",
      contact_address: "needle@example.com",
      customer_id: customer.id,
      status_id: doneStatus,
      origin: "manual",
      updated_at: needleUpdatedAt,
      created_at: needleUpdatedAt,
    })
    .select("id")
    .single();

  if (needleErr || !needle) {
    console.error("Failed to create needle ticket:", needleErr?.message);
    process.exit(1);
  }

  const { error: msgErr } = await db.from("messages").insert({
    ticket_id: needle.id,
    body: `Customer follow-up with hidden keyword ${NEEDLE_SECRET} buried in the thread.`,
    visibility: "public",
    author_type: "customer",
    channel: "admin",
  });
  if (msgErr) {
    console.error("Failed to create needle message:", msgErr.message);
    process.exit(1);
  }

  console.log(
    `Seeded ${inserted} bulk tickets + 1 needle (${NEEDLE_SECRET} in message only).`,
  );
  console.log(`Needle ticket id: ${needle.id}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
