import { NextRequest } from "next/server";
import { jsonData } from "@server/lib/response";
import { withAuth } from "@server/lib/route-handler";
import { getBoardFilterOptions } from "@server/services/board-filter-options";

export async function GET(_request: NextRequest) {
  return withAuth(_request, async () => {
    const options = await getBoardFilterOptions();
    return jsonData(options);
  });
}
