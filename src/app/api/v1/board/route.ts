import { NextRequest } from "next/server";
import { jsonData } from "@server/lib/response";
import { withAuth } from "@server/lib/route-handler";
import { getBoard } from "@server/services/board";

export async function GET(request: NextRequest) {
  return withAuth(request, async () => {
    const board = await getBoard();
    return jsonData(board);
  });
}
