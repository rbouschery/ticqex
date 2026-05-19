import { NextRequest } from "next/server";
import { jsonData } from "@server/lib/response";
import { withAuth } from "@server/lib/route-handler";
import { listUsers } from "@server/services/users";

export async function GET(request: NextRequest) {
  return withAuth(request, async () => jsonData(await listUsers()));
}
