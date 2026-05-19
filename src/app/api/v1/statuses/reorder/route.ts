import { NextRequest } from "next/server";
import { jsonData } from "@server/lib/response";
import { withAuth, parseJsonBody } from "@server/lib/route-handler";
import {
  reorderStatusesSchema,
  parseBody,
} from "@server/lib/validation/schemas";
import { reorderStatuses } from "@server/services/statuses";

export async function PUT(request: NextRequest) {
  return withAuth(
    request,
    async () => {
      const body = parseBody(
        reorderStatusesSchema,
        await parseJsonBody(request),
      );
      return jsonData(await reorderStatuses(body.ids));
    },
    { admin: true },
  );
}
