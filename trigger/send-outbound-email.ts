import { task } from "@trigger.dev/sdk/v3";
import { sendOutboundEmailForMessage } from "@server/adapters/email/outbound";

export const sendOutboundEmail = task({
  id: "send-outbound-email",
  retry: { maxAttempts: 3 },
  run: async (payload: { messageId: string }) => {
    await sendOutboundEmailForMessage(payload.messageId);
  },
});
