import { NextRequest } from "next/server";
import { jsonData } from "@server/lib/response";
import { withAuth, parseJsonBody } from "@server/lib/route-handler";
import {
  createEmailSnippetSchema,
  parseBody,
} from "@server/lib/validation/schemas";
import {
  createEmailSnippet,
  listEmailSnippets,
} from "@server/services/email-snippets";

export async function GET(request: NextRequest) {
  return withAuth(request, async () => jsonData(await listEmailSnippets()));
}

export async function POST(request: NextRequest) {
  return withAuth(
    request,
    async (auth) => {
      const body = parseBody(
        createEmailSnippetSchema,
        await parseJsonBody(request),
      );
      return jsonData(
        await createEmailSnippet({
          title: body.title,
          body: body.body,
          createdBy: auth.userId,
        }),
        201,
      );
    },
    { admin: true },
  );
}
