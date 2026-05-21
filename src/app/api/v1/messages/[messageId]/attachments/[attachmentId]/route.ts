import { NextRequest, NextResponse } from "next/server";
import { jsonData } from "@server/lib/response";
import { withAuth } from "@server/lib/route-handler";
import { getAttachmentSignedUrl } from "@server/services/attachment-uploads";

type Params = { params: Promise<{ messageId: string; attachmentId: string }> };

export async function GET(request: NextRequest, { params }: Params) {
  return withAuth(request, async () => {
    const { messageId, attachmentId } = await params;
    const url = await getAttachmentSignedUrl(messageId, attachmentId);

    if (request.nextUrl.searchParams.get("redirect") === "true") {
      return NextResponse.redirect(url);
    }

    return jsonData({ url });
  });
}
