import { NextRequest } from "next/server";
import { jsonData } from "@server/lib/response";
import { withAuth, parseJsonBody } from "@server/lib/route-handler";
import { createTagSchema, parseBody } from "@server/lib/validation/schemas";
import { listTags, createTag } from "@server/services/tags";

export async function GET(request: NextRequest) {
  return withAuth(request, async () => jsonData(await listTags()));
}

export async function POST(request: NextRequest) {
  return withAuth(
    request,
    async () => {
      const body = parseBody(createTagSchema, await parseJsonBody(request));
      return jsonData(await createTag(body), 201);
    },
    { admin: true },
  );
}
