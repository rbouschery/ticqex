import { NextRequest } from "next/server";
import { jsonData } from "@server/lib/response";
import { withAuth } from "@server/lib/route-handler";
import { revokeApiKey } from "@server/services/api-keys";

type Params = { params: Promise<{ id: string }> };

export async function DELETE(request: NextRequest, { params }: Params) {
  return withAuth(
    request,
    async () => {
      const { id } = await params;
      await revokeApiKey(id);
      return jsonData({ revoked: true });
    },
    { admin: true },
  );
}
