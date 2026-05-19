import { NextRequest } from "next/server";
import { jsonData } from "@server/lib/response";
import { withAuth, parseJsonBody } from "@server/lib/route-handler";
import { createApiKeySchema, parseBody } from "@server/lib/validation/schemas";
import { listApiKeys, createApiKey } from "@server/services/api-keys";

export async function GET(request: NextRequest) {
  return withAuth(
    request,
    async () => jsonData(await listApiKeys()),
    { admin: true },
  );
}

export async function POST(request: NextRequest) {
  return withAuth(
    request,
    async (auth) => {
      const body = parseBody(createApiKeySchema, await parseJsonBody(request));
      const key = await createApiKey(body.name, auth.userId);
      return jsonData(key, 201);
    },
    { admin: true },
  );
}
