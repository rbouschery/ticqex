import { task } from "@trigger.dev/sdk/v3";
import { resendAdapter } from "@server/adapters/email/resend";
import { processInboundEmail } from "@server/services/email-inbound";
import type { InboundWebhookPayload } from "@server/adapters/email/types";

export const processInboundEmailTask = task({
  id: "process-inbound-email",
  retry: { maxAttempts: 3 },
  run: async (payload: { raw: InboundWebhookPayload }) => {
    const parsed = resendAdapter.parseInbound(payload.raw);
    return processInboundEmail(parsed);
  },
});
