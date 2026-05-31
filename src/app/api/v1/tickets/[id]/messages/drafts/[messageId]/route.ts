import { NextRequest } from "next/server";
import { jsonData } from "@server/lib/response";
import { withAuth, parseJsonBody } from "@server/lib/route-handler";
import { messageInputSchema, parseBody } from "@server/lib/validation/schemas";
import {
  deleteAgentDraft,
  updateAgentDraft,
} from "@server/services/messages";

type Params = { params: Promise<{ id: string; messageId: string }> };

export async function PATCH(request: NextRequest, { params }: Params) {
  return withAuth(request, async (auth) => {
    const { id, messageId } = await params;
    const body = parseBody(messageInputSchema, await parseJsonBody(request));
    const { message } = await updateAgentDraft(
      id,
      messageId,
      {
        body: body.body,
        email: body.email,
      },
      auth,
    );
    return jsonData(message);
  });
}

export async function DELETE(_request: NextRequest, { params }: Params) {
  return withAuth(_request, async (auth) => {
    const { id, messageId } = await params;
    return jsonData(await deleteAgentDraft(id, messageId, auth));
  });
}
