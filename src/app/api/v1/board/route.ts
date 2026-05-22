import { NextRequest } from "next/server";
import { jsonData } from "@server/lib/response";
import { withAuth } from "@server/lib/route-handler";
import { parseTicketFilterParam } from "@server/domain/ticket-filter";
import { parseBoardSortParam } from "@server/domain/board-sort";
import { getBoard } from "@server/services/board";

export async function GET(request: NextRequest) {
  return withAuth(request, async (auth) => {
    const filter = parseTicketFilterParam(request.nextUrl.searchParams.get("filter"));
    const sort = parseBoardSortParam(request.nextUrl.searchParams.get("sort"));
    const board = await getBoard(auth.userId, filter, sort);
    return jsonData(board);
  });
}
