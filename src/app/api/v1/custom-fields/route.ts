import { NextRequest } from "next/server";
import { jsonData } from "@server/lib/response";
import { withAuth, parseJsonBody } from "@server/lib/route-handler";
import {
  createCustomFieldSchema,
  parseBody,
} from "@server/lib/validation/schemas";
import {
  listDefinitions,
  createDefinition,
} from "@server/services/custom-fields";
import { createAdminClient } from "@server/lib/supabase-admin";

export async function GET(request: NextRequest) {
  return withAuth(request, async () => {
    const group = request.nextUrl.searchParams.get("group") as
      | "ticket"
      | "customer"
      | null;
    return jsonData(
      await listDefinitions(createAdminClient(), group ?? undefined),
    );
  });
}

export async function POST(request: NextRequest) {
  return withAuth(
    request,
    async () => {
      const body = parseBody(
        createCustomFieldSchema,
        await parseJsonBody(request),
      );
      return jsonData(await createDefinition(createAdminClient(), body), 201);
    },
    { admin: true },
  );
}
