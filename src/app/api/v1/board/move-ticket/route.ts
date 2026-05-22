import { NextRequest } from "next/server";
import { jsonData } from "@server/lib/response";
import { withAuth, parseJsonBody } from "@server/lib/route-handler";
import {
  boardMoveTicketSchema,
  parseBody,
} from "@server/lib/validation/schemas";
import { moveTicketOnBoard } from "@server/services/board-move";

export async function POST(request: NextRequest) {
  return withAuth(request, async (auth) => {
    const body = parseBody(
      boardMoveTicketSchema,
      await parseJsonBody(request),
    );
    return jsonData(
      await moveTicketOnBoard(auth.userId, {
        ticket_id: body.ticket_id,
        from_status_id: body.from_status_id,
        to_status_id: body.to_status_id,
        target_ticket_ids: body.target_ticket_ids,
        source_ticket_ids: body.source_ticket_ids,
        filter_context: body.filter_context,
      }),
    );
  });
}
