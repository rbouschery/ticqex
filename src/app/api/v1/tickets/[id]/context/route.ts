import { NextRequest } from "next/server";
import { withAuth } from "@server/lib/route-handler";
import { getTicketContext } from "@server/services/tickets";

type Params = { params: Promise<{ id: string }> };

export async function GET(request: NextRequest, { params }: Params) {
  return withAuth(request, async () => {
    const { id } = await params;
    const excludeInternal =
      request.nextUrl.searchParams.get("exclude_internal") === "true";
    const markdown = await getTicketContext(id, excludeInternal);
    return new Response(markdown, {
      headers: { "Content-Type": "text/markdown; charset=utf-8" },
    });
  });
}
