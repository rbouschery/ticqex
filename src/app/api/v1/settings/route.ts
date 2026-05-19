import { NextRequest } from "next/server";
import { jsonData } from "@server/lib/response";
import { withAuth, parseJsonBody } from "@server/lib/route-handler";
import {
  patchSettingsSchema,
  parseBody,
} from "@server/lib/validation/schemas";
import { getSettings, patchSettings } from "@server/services/settings";

export async function GET(request: NextRequest) {
  return withAuth(request, async () => jsonData(await getSettings()));
}

export async function PATCH(request: NextRequest) {
  return withAuth(
    request,
    async () => {
      const body = parseBody(patchSettingsSchema, await parseJsonBody(request));
      return jsonData(await patchSettings(body));
    },
    { admin: true },
  );
}
