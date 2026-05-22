import { NextRequest } from "next/server";
import { jsonData } from "@server/lib/response";
import { withAuth, parseJsonBody } from "@server/lib/route-handler";
import {
  seedManualLaneOrdersSchema,
  parseBody,
} from "@server/lib/validation/schemas";
import { seedManualLaneOrders } from "@server/services/board-lane-orders";

export async function PUT(request: NextRequest) {
  return withAuth(request, async (auth) => {
    const body = parseBody(
      seedManualLaneOrdersSchema,
      await parseJsonBody(request),
    );
    const lanes = await seedManualLaneOrders(auth.userId, body.lanes, {
      onlyIfEmpty: body.only_if_empty,
      mergeVisible: body.merge_visible,
    });
    return jsonData({ lanes });
  });
}
