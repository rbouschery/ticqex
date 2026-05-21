import { NextRequest } from "next/server";
import { jsonData } from "@server/lib/response";
import { ApiError } from "@server/lib/errors";
import { withAuth } from "@server/lib/route-handler";
import { stageAttachmentUpload } from "@server/services/attachment-uploads";

type Params = { params: Promise<{ id: string }> };

export async function POST(request: NextRequest, { params }: Params) {
  return withAuth(request, async (auth) => {
    const { id: ticketId } = await params;
    const formData = await request.formData();
    const file = formData.get("file");

    if (!(file instanceof File)) {
      throw ApiError.badRequest("Missing file field");
    }

    const upload = await stageAttachmentUpload(ticketId, file, auth.userId);
    return jsonData(
      {
        id: upload.id,
        filename: upload.filename,
        content_type: upload.content_type,
        size_bytes: upload.size_bytes,
      },
      201,
    );
  });
}
