import { NextRequest } from "next/server";
import { jsonData } from "@server/lib/response";
import { withAuth } from "@server/lib/route-handler";
import { deleteEmailSnippet } from "@server/services/email-snippets";

type Params = { params: Promise<{ id: string }> };

export async function DELETE(request: NextRequest, { params }: Params) {
  return withAuth(
    request,
    async () => {
      const { id } = await params;
      await deleteEmailSnippet(id);
      return jsonData({ deleted: true });
    },
    { admin: true },
  );
}
