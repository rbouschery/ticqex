import { NextRequest } from "next/server";
import { jsonData } from "@server/lib/response";
import { withAuth, parseJsonBody } from "@server/lib/route-handler";
import {
  boardLaneOrderSchema,
  parseBody,
} from "@server/lib/validation/schemas";
import { setLaneOrder } from "@server/services/board-lane-orders";

type Params = { params: Promise<{ statusId: string }> };

export async function PUT(request: NextRequest, { params }: Params) {
  return withAuth(request, async (auth) => {
    const { statusId } = await params;
    const body = parseBody(
      boardLaneOrderSchema,
      await parseJsonBody(request),
    );
    const ticketIds = await setLaneOrder(
      auth.userId,
      statusId,
      body.ticket_ids,
      body.visible_ticket_ids?.length
        ? {
            visibleTicketIds: body.visible_ticket_ids,
            removedTicketIds: body.removed_ticket_ids,
          }
        : undefined,
    );
    return jsonData({ status_id: statusId, ticket_ids: ticketIds });
  });
}
