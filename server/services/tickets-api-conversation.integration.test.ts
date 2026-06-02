import { afterEach, expect } from "vitest";
import { isChannelOperational } from "@server/config/channel-gate";
import { createAgentReply } from "@server/services/messages";
import { createTicket } from "@server/services/tickets";
import {
  adminDb,
  describeIntegration,
  staffAuth,
  signInAsSeedAdmin,
} from "../../tests/helpers/integration";

const FORM_BODY = "I was charged twice for my subscription.";
const AGENT_BODY = "Thanks for reaching out — we're looking into this.";

describeIntegration("API conversation tickets", () => {
  let ticketId: string;

  afterEach(async () => {
    if (ticketId) await adminDb().from("tickets").delete().eq("id", ticketId);
  });

  it("creates conversation tickets via API and quotes form text in agent replies", async () => {
    const { userId } = await signInAsSeedAdmin();
    const auth = staffAuth(userId);
    const contactAddress = `api-conversation-${Date.now()}@ticqex.local`;

    const ticket = await createTicket(
      {
        kind: "conversation",
        title: "Help with billing",
        contact_address: contactAddress,
        message: { body: FORM_BODY },
      },
      auth,
    );
    ticketId = ticket.id;

    expect(ticket.kind).toBe("conversation");
    expect(ticket.channel).toBe("email");
    expect(ticket.origin).toBe("api");
    expect(ticket.contact_address).toBe(contactAddress);

    const customerMessages = ticket.messages.filter(
      (m) => m.author_type === "customer",
    );
    expect(customerMessages).toHaveLength(1);
    expect(customerMessages[0]!.channel).toBe("api");
    expect(customerMessages[0]!.body).toBe(FORM_BODY);

    const { message: reply } = await createAgentReply(
      ticketId,
      { body: AGENT_BODY, channel: "api" },
      auth,
    );

    expect(reply.body).toContain("On ");
    expect(reply.body).toContain(" wrote:");
    expect(reply.body).toContain(`> ${FORM_BODY.split("\n")[0]}`);
    expect(reply.body).toContain(AGENT_BODY);

    if (isChannelOperational("email")) {
      expect(reply.email_delivery_status).toBe("pending");
    }
  });
});
