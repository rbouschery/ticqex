import { afterEach, expect } from "vitest";
import { getTicket, getTicketSummary } from "@server/services/tickets";
import {
  getUnreadCountsByTicket,
  markTicketMessagesRead,
  setMessageReadState,
} from "@server/services/message-reads";
import {
  adminDb,
  describeIntegration,
  getFirstCustomerId,
  getFirstStatusId,
  insertCustomerMessage,
  insertMinimalTicket,
  signInAsSeedAdmin,
} from "../../tests/helpers/integration";

describeIntegration("message reads", () => {
  let ticketId: string;
  let messageId: string;
  let userId: string;

  afterEach(async () => {
    if (ticketId) await adminDb().from("tickets").delete().eq("id", ticketId);
  });

  it("tracks unread counts, mark-read, and toggle", async () => {
    const session = await signInAsSeedAdmin();
    userId = session.userId;
    const db = adminDb();
    const statusId = await getFirstStatusId(db);
    const customerId = await getFirstCustomerId(db);

    const ticket = await insertMinimalTicket(
      {
        title: "Read/unread integration test",
        kind: "conversation",
        status_id: statusId,
        customer_id: customerId,
        channel: "email",
        contact_address: "read-test@ticqex.local",
        origin: "manual",
      },
      db,
    );
    ticketId = ticket.id;

    const message = await insertCustomerMessage(
      ticketId,
      "Unread customer reply for integration test",
      db,
    );
    messageId = message.id;

    const counts = await getUnreadCountsByTicket([ticketId], userId);
    expect(counts.get(ticketId)).toBe(1);

    const summary = await getTicketSummary(ticketId, userId);
    expect(summary.unread_count).toBe(1);

    const detail = await getTicket(ticketId, userId);
    const detailMsg = detail.messages.find((m) => m.id === messageId);
    expect(detailMsg?.read).toBe(false);

    const markResult = await markTicketMessagesRead(ticketId, userId);
    expect(markResult.marked).toBe(1);

    const countsAfter = await getUnreadCountsByTicket([ticketId], userId);
    expect(countsAfter.get(ticketId) ?? 0).toBe(0);

    const toggle = await setMessageReadState(messageId, userId);
    expect(toggle.read).toBe(false);

    const { count } = await db
      .from("message_reads")
      .select("*", { count: "exact", head: true })
      .eq("user_id", userId)
      .eq("message_id", messageId);
    expect(count).toBe(0);
  });
});
