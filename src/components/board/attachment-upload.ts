import type { AttachmentUpload } from "./types";

type ApiResponse<T> = { data: T } | { error: { code: string; message: string } };

export async function uploadAttachment(
  ticketId: string,
  file: File,
): Promise<AttachmentUpload> {
  const form = new FormData();
  form.append("file", file);
  const res = await fetch(`/api/v1/tickets/${ticketId}/attachment-uploads`, {
    method: "POST",
    credentials: "include",
    body: form,
  });
  const json = (await res.json()) as ApiResponse<AttachmentUpload>;
  if ("error" in json) throw new Error(json.error.message);
  if (!res.ok) throw new Error("Upload failed");
  return json.data;
}
