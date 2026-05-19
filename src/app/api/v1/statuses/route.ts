import { NextRequest } from "next/server";
import { jsonData } from "@server/lib/response";
import { withAuth, parseJsonBody } from "@server/lib/route-handler";
import {
  createStatusSchema,
  parseBody,
} from "@server/lib/validation/schemas";
import { listStatuses, createStatus } from "@server/services/statuses";

export async function GET(request: NextRequest) {
  return withAuth(request, async () => jsonData(await listStatuses()));
}

export async function POST(request: NextRequest) {
  return withAuth(
    request,
    async () => {
      const body = parseBody(createStatusSchema, await parseJsonBody(request));
      return jsonData(await createStatus(body), 201);
    },
    { admin: true },
  );
}
