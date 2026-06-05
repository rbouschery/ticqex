import { createAdminClient } from "@server/lib/supabase-admin";
import { ApiError } from "@server/lib/errors";

type StatusRow = {
  id: string;
  name: string;
  color: string;
  position: number;
  is_visible: boolean;
  created_at: string;
  tickets?: { count: number }[];
};

function mapStatus(row: StatusRow) {
  return {
    id: row.id,
    name: row.name,
    color: row.color,
    position: row.position,
    is_visible: row.is_visible,
    created_at: row.created_at,
    ticket_count: row.tickets?.[0]?.count ?? 0,
  };
}

export async function listStatuses() {
  const db = createAdminClient();
  const { data, error } = await db
    .from("status_types")
    .select("*, tickets(count)")
    .order("position");
  if (error) throw ApiError.internal(error.message);
  return (data ?? []).map((row) => mapStatus(row as StatusRow));
}

export async function getDefaultStatusId() {
  const statuses = await listStatuses();
  if (!statuses.length) throw ApiError.internal("No status types configured");
  return statuses[0]!.id;
}

export async function getVisibleStatusIds(db = createAdminClient()) {
  const { data, error } = await db
    .from("status_types")
    .select("id")
    .eq("is_visible", true)
    .order("position");
  if (error) throw ApiError.internal(error.message);
  return (data ?? []).map((row) => row.id as string);
}

export async function getInboundEmailStatusId() {
  const db = createAdminClient();
  const { data: settings, error: settingsErr } = await db
    .from("global_settings")
    .select("default_inbound_status_id")
    .eq("id", 1)
    .single();
  if (settingsErr) throw ApiError.internal(settingsErr.message);

  if (settings?.default_inbound_status_id) {
    const { data: status, error: statusErr } = await db
      .from("status_types")
      .select("id")
      .eq("id", settings.default_inbound_status_id)
      .maybeSingle();
    if (statusErr) throw ApiError.internal(statusErr.message);
    if (status) return status.id;
  }

  return getDefaultStatusId();
}

async function assertCanHideStatus(id: string) {
  const db = createAdminClient();
  const { count, error } = await db
    .from("status_types")
    .select("*", { count: "exact", head: true })
    .eq("is_visible", true)
    .neq("id", id);
  if (error) throw ApiError.internal(error.message);
  if ((count ?? 0) === 0) {
    throw ApiError.conflict("At least one status must remain visible on the board");
  }
}

async function assertNotOnlyStatus(id: string) {
  const db = createAdminClient();
  const { count, error } = await db
    .from("status_types")
    .select("*", { count: "exact", head: true })
    .neq("id", id);
  if (error) throw ApiError.internal(error.message);
  if ((count ?? 0) === 0) {
    throw ApiError.conflict("Cannot delete the only status type");
  }
}

export async function createStatus(input: {
  name: string;
  color?: string;
  position?: number;
  is_visible?: boolean;
}) {
  const db = createAdminClient();
  let position = input.position;
  if (position === undefined) {
    const { data: max } = await db
      .from("status_types")
      .select("position")
      .order("position", { ascending: false })
      .limit(1)
      .maybeSingle();
    position = (max?.position ?? -1) + 1;
  }

  const { data, error } = await db
    .from("status_types")
    .insert({
      name: input.name,
      color: input.color ?? "#6366f1",
      position,
      is_visible: input.is_visible ?? true,
    })
    .select("*, tickets(count)")
    .single();

  if (error) throw ApiError.internal(error.message);
  return mapStatus(data as StatusRow);
}

export async function updateStatus(
  id: string,
  patch: {
    name?: string;
    color?: string;
    position?: number;
    is_visible?: boolean;
  },
) {
  if (patch.is_visible === false) {
    await assertCanHideStatus(id);
  }

  const db = createAdminClient();
  const { data, error } = await db
    .from("status_types")
    .update(patch)
    .eq("id", id)
    .select("*, tickets(count)")
    .single();
  if (error) throw ApiError.internal(error.message);
  if (!data) throw ApiError.notFound("Status not found");
  return mapStatus(data as StatusRow);
}

export async function deleteStatus(id: string, reassignTo?: string) {
  const db = createAdminClient();

  await assertNotOnlyStatus(id);

  const { count: ticketCount, error: countErr } = await db
    .from("tickets")
    .select("*", { count: "exact", head: true })
    .eq("status_id", id);
  if (countErr) throw ApiError.internal(countErr.message);

  if ((ticketCount ?? 0) > 0) {
    if (!reassignTo) {
      throw ApiError.conflict(
        `Status has ${ticketCount} ticket(s); provide reassign_to`,
      );
    }
    if (reassignTo === id) {
      throw ApiError.badRequest("reassign_to must be a different status");
    }

    const { data: target } = await db
      .from("status_types")
      .select("id")
      .eq("id", reassignTo)
      .maybeSingle();
    if (!target) throw ApiError.badRequest("reassign_to status not found");

    const { error: moveErr } = await db
      .from("tickets")
      .update({ status_id: reassignTo })
      .eq("status_id", id);
    if (moveErr) throw ApiError.internal(moveErr.message);
  }

  const { error } = await db.from("status_types").delete().eq("id", id);
  if (error) throw ApiError.internal(error.message);
}

export async function reorderStatuses(ids: string[]) {
  const db = createAdminClient();

  const { data: existing, error: listErr } = await db
    .from("status_types")
    .select("id");
  if (listErr) throw ApiError.internal(listErr.message);

  const existingIds = new Set((existing ?? []).map((s) => s.id));
  if (
    ids.length !== existingIds.size ||
    ids.some((id) => !existingIds.has(id))
  ) {
    throw ApiError.badRequest("ids must include every status exactly once");
  }

  const { error } = await db.rpc("reorder_status_types", {
    ordered_ids: ids,
  });
  if (error) {
    if (error.message.includes("ids must include every status exactly once")) {
      throw ApiError.badRequest("ids must include every status exactly once");
    }
    throw ApiError.internal(error.message);
  }
  return listStatuses();
}
