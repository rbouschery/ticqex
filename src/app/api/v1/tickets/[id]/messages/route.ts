import { NextRequest } from "next/server";
import { jsonData } from "@server/lib/response";
import { withAuth, parseJsonBody } from "@server/lib/route-handler";
import { messageInputSchema, parseBody } from "@server/lib/validation/schemas";
import { listMessages, createMessage } from "@server/services/tickets";
import { enqueueOutboundEmail } from "@server/adapters/email/outbound";

type Params = { params: Promise<{ id: string }> };

export async function GET(request: NextRequest, { params }: Params) {
  return withAuth(request, async () => {
    const { id } = await params;
    return jsonData(await listMessages(id));
  });
}

export async function POST(request: NextRequest, { params }: Params) {
  return withAuth(request, async (auth) => {
    const { id } = await params;
    const body = parseBody(messageInputSchema, await parseJsonBody(request));
    const { message, shouldSendEmail } = await createMessage(
      id,
      {
        body: body.body,
        visibility: body.visibility,
        channel: body.channel ?? "admin",
      },
      auth,
    );

    if (shouldSendEmail) {
      await enqueueOutboundEmail(message.id);
    }

    return jsonData(message, 201);
  });
}
