import { NextRequest } from "next/server";
import { jsonData } from "@server/lib/response";
import { withAuth, parseJsonBody } from "@server/lib/route-handler";
import { updateTagSchema, parseBody } from "@server/lib/validation/schemas";
import { updateTag, deleteTag } from "@server/services/tags";

type Params = { params: Promise<{ id: string }> };

export async function PATCH(request: NextRequest, { params }: Params) {
  return withAuth(
    request,
    async () => {
      const { id } = await params;
      const body = parseBody(updateTagSchema, await parseJsonBody(request));
      return jsonData(await updateTag(id, body));
    },
    { admin: true },
  );
}

export async function DELETE(request: NextRequest, { params }: Params) {
  return withAuth(
    request,
    async () => {
      const { id } = await params;
      await deleteTag(id);
      return jsonData({ deleted: true });
    },
    { admin: true },
  );
}
