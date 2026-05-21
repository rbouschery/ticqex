import { NextRequest } from "next/server";
import { jsonData } from "@server/lib/response";
import { ApiError } from "@server/lib/errors";
import { withAuth } from "@server/lib/route-handler";
import {
  parseBody,
  toggleMessageReadSchema,
} from "@server/lib/validation/schemas";
import { setMessageReadState } from "@server/services/message-reads";

type Params = { params: Promise<{ id: string; messageId: string }> };

async function parseOptionalJsonBody(request: NextRequest) {
  const text = await request.text();
  if (!text.trim()) return {};
  try {
    return JSON.parse(text) as unknown;
  } catch {
    throw ApiError.badRequest("Invalid JSON body");
  }
}

export async function PATCH(request: NextRequest, { params }: Params) {
  return withAuth(request, async (auth) => {
    const { id, messageId } = await params;
    const body = parseBody(toggleMessageReadSchema, await parseOptionalJsonBody(request));
    const result = await setMessageReadState(messageId, auth.userId, body.read);
    if (result.ticket_id !== id) {
      throw ApiError.notFound("Message not found on this ticket");
    }
    return jsonData(result);
  });
}
