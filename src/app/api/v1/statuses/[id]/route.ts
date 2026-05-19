import { NextRequest } from "next/server";
import { jsonData } from "@server/lib/response";
import { withAuth, parseJsonBody } from "@server/lib/route-handler";
import {
  updateStatusSchema,
  parseBody,
} from "@server/lib/validation/schemas";
import { updateStatus, deleteStatus } from "@server/services/statuses";

type Params = { params: Promise<{ id: string }> };

export async function PATCH(request: NextRequest, { params }: Params) {
  return withAuth(
    request,
    async () => {
      const { id } = await params;
      const body = parseBody(updateStatusSchema, await parseJsonBody(request));
      return jsonData(await updateStatus(id, body));
    },
    { admin: true },
  );
}

export async function DELETE(request: NextRequest, { params }: Params) {
  return withAuth(
    request,
    async () => {
      const { id } = await params;
      await deleteStatus(id);
      return jsonData({ deleted: true });
    },
    { admin: true },
  );
}
