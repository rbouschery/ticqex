import { NextRequest } from "next/server";
import { jsonData, jsonList } from "@server/lib/response";
import { withAuth, parseJsonBody } from "@server/lib/route-handler";
import { parseBody, createTicketSchema } from "@server/lib/validation/schemas";
import { listTickets, createTicket } from "@server/services/tickets";
export async function GET(request: NextRequest) {
  return withAuth(request, async () => {
    const result = await listTickets(request.nextUrl.searchParams, { filters: {} });
    return jsonList(result.tickets, {
      total: result.total,
      page: result.page,
      per_page: result.perPage,
      filters: result.meta?.filters,
    });
  });
}

export async function POST(request: NextRequest) {
  return withAuth(request, async (auth) => {
    const body = parseBody(createTicketSchema, await parseJsonBody(request));
    const ticket = await createTicket(body, auth);
    return jsonData(ticket, 201);
  });
}
