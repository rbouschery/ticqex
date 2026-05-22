import { NextRequest } from "next/server";
import { withAuth } from "@server/lib/route-handler";
import { getTicketContext } from "@server/services/ticket-context";

type Params = { params: Promise<{ id: string }> };

export async function GET(request: NextRequest, { params }: Params) {
  return withAuth(request, async () => {
    const { id } = await params;
    const markdown = await getTicketContext(id);
    return new Response(markdown, {
      headers: { "Content-Type": "text/markdown; charset=utf-8" },
    });
  });
}
