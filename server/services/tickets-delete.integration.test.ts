import { afterEach, expect } from "vitest";
import { deleteTicket } from "@server/services/tickets";
import {
  adminDb,
  describeIntegration,
  getFirstStatusId,
  signInAsSeedAdmin,
} from "../../tests/helpers/integration";

describeIntegration("ticket delete", () => {
  let ticketId: string | null = null;
  let fieldId: string | null = null;
  let statusId: string | null = null;
  let userId: string;
  let previousLaneOrder: string[] | null = null;

  afterEach(async () => {
    const db = adminDb();
    if (ticketId) await db.from("tickets").delete().eq("id", ticketId);
    if (fieldId) await db.from("custom_field_definitions").delete().eq("id", fieldId);
    if (statusId && previousLaneOrder && userId) {
      if (previousLaneOrder.length) {
        await db.from("board_lane_orders").upsert(
          {
            user_id: userId,
            status_id: statusId,
            ticket_ids: previousLaneOrder,
            updated_at: new Date().toISOString(),
          },
          { onConflict: "user_id,status_id" },
        );
      } else {
        await db
          .from("board_lane_orders")
          .delete()
          .eq("user_id", userId)
          .eq("status_id", statusId);
      }
    }
  });

  it("removes ticket, custom field values, and lane order entries", async () => {
    const session = await signInAsSeedAdmin();
    userId = session.userId;
    const db = adminDb();

    statusId = await getFirstStatusId(db);

    const { data: ticket, error: ticketErr } = await db
      .from("tickets")
      .insert({
        title: "Ticket delete integration test",
        kind: "task",
        body: "This ticket should be deleted by the integration test.",
        status_id: statusId,
        origin: "manual",
      })
      .select("id")
      .single();
    if (ticketErr || !ticket) throw new Error(ticketErr?.message ?? "ticket insert failed");
    ticketId = ticket.id as string;

    const fieldKey = `delete_test_${ticketId.replaceAll("-", "_")}`;
    const { data: field, error: fieldErr } = await db
      .from("custom_field_definitions")
      .insert({
        group: "ticket",
        key: fieldKey,
        label: "Delete test field",
        type: "text",
      })
      .select("id")
      .single();
    if (fieldErr || !field) throw new Error(fieldErr?.message ?? "custom field insert failed");
    fieldId = field.id as string;

    const { error: valueErr } = await db.from("custom_field_values").insert({
      field_id: fieldId,
      entity_type: "ticket",
      entity_id: ticketId,
      value_text: "delete me",
    });
    if (valueErr) throw new Error(valueErr.message);

    const { data: laneOrder } = await db
      .from("board_lane_orders")
      .select("ticket_ids")
      .eq("user_id", userId)
      .eq("status_id", statusId)
      .maybeSingle();
    previousLaneOrder = ((laneOrder?.ticket_ids as string[] | null) ?? []).filter(
      (id) => id !== ticketId,
    );

    const { error: laneErr } = await db.from("board_lane_orders").upsert(
      {
        user_id: userId,
        status_id: statusId,
        ticket_ids: [ticketId, ...previousLaneOrder],
        updated_at: new Date().toISOString(),
      },
      { onConflict: "user_id,status_id" },
    );
    if (laneErr) throw new Error(laneErr.message);

    const deletedId = ticketId;
    await deleteTicket(deletedId);
    ticketId = null;

    const { count: ticketCount } = await db
      .from("tickets")
      .select("*", { count: "exact", head: true })
      .eq("id", deletedId);
    expect(ticketCount).toBe(0);

    const { count: valueCount } = await db
      .from("custom_field_values")
      .select("*", { count: "exact", head: true })
      .eq("entity_type", "ticket")
      .eq("entity_id", deletedId);
    expect(valueCount).toBe(0);

    const { data: laneAfter } = await db
      .from("board_lane_orders")
      .select("ticket_ids")
      .eq("user_id", userId)
      .eq("status_id", statusId)
      .maybeSingle();
    const ticketIds = (laneAfter?.ticket_ids as string[] | null) ?? [];
    expect(ticketIds).not.toContain(deletedId);
  });
});
