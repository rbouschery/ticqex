import { NextRequest } from "next/server";
import { jsonData } from "@server/lib/response";
import { withAuth, parseJsonBody } from "@server/lib/route-handler";
import {
  updateCustomFieldSchema,
  parseBody,
} from "@server/lib/validation/schemas";
import {
  updateDefinition,
  deleteDefinition,
} from "@server/services/custom-fields";
import { createAdminClient } from "@server/lib/supabase-admin";

type Params = { params: Promise<{ id: string }> };

export async function PATCH(request: NextRequest, { params }: Params) {
  return withAuth(
    request,
    async () => {
      const { id } = await params;
      const body = parseBody(
        updateCustomFieldSchema,
        await parseJsonBody(request),
      );
      return jsonData(await updateDefinition(createAdminClient(), id, body));
    },
    { admin: true },
  );
}

export async function DELETE(request: NextRequest, { params }: Params) {
  return withAuth(
    request,
    async () => {
      const { id } = await params;
      await deleteDefinition(createAdminClient(), id);
      return jsonData({ deleted: true });
    },
    { admin: true },
  );
}
