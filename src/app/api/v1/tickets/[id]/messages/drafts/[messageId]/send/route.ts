import { NextRequest } from "next/server";
import { jsonData } from "@server/lib/response";
import { withAuth } from "@server/lib/route-handler";
import { ApiError } from "@server/lib/errors";
import { parseBody, sendDraftSchema } from "@server/lib/validation/schemas";
import { sendAgentDraft } from "@server/services/messages";
import { enqueueChannelOutbound } from "@server/channels/email/background";
import { isChannelOperational } from "@server/config/channel-gate";

type Params = { params: Promise<{ id: string; messageId: string }> };

export async function POST(request: NextRequest, { params }: Params) {
  return withAuth(request, async (auth) => {
    const { id, messageId } = await params;
    const text = await request.text();
    let payload: unknown = {};
    if (text.trim()) {
      try {
        payload = JSON.parse(text);
      } catch {
        throw ApiError.badRequest("Invalid JSON body");
      }
    }
    const body = parseBody(sendDraftSchema, payload);
    const { message, shouldSendEmail } = await sendAgentDraft(
      id,
      messageId,
      body,
      auth,
    );

    if (shouldSendEmail) {
      if (!isChannelOperational("email")) {
        throw ApiError.serviceUnavailable(
          "Email channel is disabled or integration is not configured",
        );
      }
      enqueueChannelOutbound("email", message.id);
    }

    return jsonData(message);
  });
}
