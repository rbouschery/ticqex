import { NextRequest } from "next/server";
import { jsonData } from "@server/lib/response";
import { withAuth, parseJsonBody } from "@server/lib/route-handler";
import { messageInputSchema, parseBody } from "@server/lib/validation/schemas";
import {
  createAgentDraft,
  listEnrichedDrafts,
} from "@server/services/messages";

type Params = { params: Promise<{ id: string }> };

export async function GET(request: NextRequest, { params }: Params) {
  return withAuth(request, async () => {
    const { id } = await params;
    return jsonData(await listEnrichedDrafts(id));
  });
}

export async function POST(request: NextRequest, { params }: Params) {
  return withAuth(request, async (auth) => {
    const { id } = await params;
    const body = parseBody(messageInputSchema, await parseJsonBody(request));
    const { message } = await createAgentDraft(
      id,
      {
        body: body.body,
        channel: body.channel ?? "admin",
        email: body.email,
      },
      auth,
    );

    return jsonData(message, 201);
  });
}
