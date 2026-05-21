import { NextRequest } from "next/server";
import { jsonData } from "@server/lib/response";
import { withAuth, parseJsonBody } from "@server/lib/route-handler";
import { parseBody, updateTicketSchema } from "@server/lib/validation/schemas";
import { getTicket, updateTicket, deleteTicket } from "@server/services/tickets";

type Params = { params: Promise<{ id: string }> };

export async function GET(request: NextRequest, { params }: Params) {
  return withAuth(request, async (auth) => {
    const { id } = await params;
    return jsonData(await getTicket(id, auth.userId));
  });
}

export async function PATCH(request: NextRequest, { params }: Params) {
  return withAuth(request, async () => {
    const { id } = await params;
    const body = parseBody(updateTicketSchema, await parseJsonBody(request));
    return jsonData(await updateTicket(id, body));
  });
}

export async function DELETE(request: NextRequest, { params }: Params) {
  return withAuth(request, async () => {
    const { id } = await params;
    await deleteTicket(id);
    return jsonData({ deleted: true });
  });
}
