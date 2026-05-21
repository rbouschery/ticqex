import { NextRequest } from "next/server";
import { jsonData } from "@server/lib/response";
import { withAuth } from "@server/lib/route-handler";
import { getBoard } from "@server/services/board";

export async function GET(request: NextRequest) {
  return withAuth(request, async (auth) => {
    const board = await getBoard(auth.userId);
    return jsonData(board);
  });
}
