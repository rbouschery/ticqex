import { NextRequest } from "next/server";
import { jsonData } from "@server/lib/response";
import { withAuth } from "@server/lib/route-handler";
import { getMe } from "@server/services/users";

export async function GET(request: NextRequest) {
  return withAuth(request, async (auth) => jsonData(await getMe(auth.userId)));
}
