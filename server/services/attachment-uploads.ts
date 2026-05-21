import { createAdminClient } from "@server/lib/supabase-admin";
import { ApiError } from "@server/lib/errors";
import { isConversationTicket } from "@server/domain/ticket";
import type { TicketRow } from "@server/domain/ticket";
import {
  ATTACHMENTS_BUCKET,
  finalPath,
  pendingPath,
} from "@server/services/attachment-paths";

const MAX_UPLOAD_BYTES = 10 * 1024 * 1024;

export type PersistMessageAttachmentInput = {
  ticketId: string;
  messageId: string;
  filename: string;
  contentType: string;
  sizeBytes: number;
} & (
  | { content: Buffer; upsert?: boolean }
  | { storagePath: string }
);

/** Upload (or reuse existing path) + insert `attachments` row. Returns false on storage failure. */
export async function persistMessageAttachment(
  input: PersistMessageAttachmentInput,
): Promise<boolean> {
  const db = createAdminClient();
  const storagePath =
    "storagePath" in input
      ? input.storagePath
      : finalPath(input.ticketId, input.messageId, input.filename);

  if ("content" in input) {
    const { error: uploadError } = await db.storage
      .from(ATTACHMENTS_BUCKET)
      .upload(storagePath, input.content, {
        contentType: input.contentType,
        upsert: input.upsert ?? false,
      });
    if (uploadError) {
      console.error("Attachment upload failed:", uploadError.message);
      return false;
    }
  }

  await db.from("attachments").insert({
    message_id: input.messageId,
    filename: input.filename,
    content_type: input.contentType,
    size_bytes: input.sizeBytes,
    storage_path: storagePath,
  });

  return true;
}

export type StagedUpload = {
  id: string;
  filename: string;
  content_type: string;
  size_bytes: number;
  storage_path: string;
};

export async function stageAttachmentUpload(
  ticketId: string,
  file: File,
  uploadedBy: string,
): Promise<StagedUpload> {
  if (file.size > MAX_UPLOAD_BYTES) {
    throw ApiError.badRequest("Attachment exceeds 10MB limit");
  }

  const db = createAdminClient();
  const { data: ticket } = await db
    .from("tickets")
    .select("id, kind")
    .eq("id", ticketId)
    .maybeSingle();
  if (!ticket) throw ApiError.notFound("Ticket not found");
  if (!isConversationTicket(ticket as TicketRow)) {
    throw ApiError.badRequest("Task tickets do not support message attachments");
  }

  const uploadId = crypto.randomUUID();
  const filename = file.name || "attachment";
  const storagePath = pendingPath(ticketId, uploadId, filename);
  const buffer = Buffer.from(await file.arrayBuffer());

  const { error: uploadError } = await db.storage
    .from(ATTACHMENTS_BUCKET)
    .upload(storagePath, buffer, {
      contentType: file.type || "application/octet-stream",
      upsert: false,
    });
  if (uploadError) throw ApiError.internal(uploadError.message);

  const { data, error } = await db
    .from("message_attachment_uploads")
    .insert({
      id: uploadId,
      ticket_id: ticketId,
      filename,
      content_type: file.type || "application/octet-stream",
      size_bytes: file.size,
      storage_path: storagePath,
      uploaded_by: uploadedBy,
    })
    .select("id, filename, content_type, size_bytes, storage_path")
    .single();
  if (error) throw ApiError.internal(error.message);

  return data;
}

/** Link staged uploads to the outbound message (no storage move). */
export async function linkUploadsToMessage(
  ticketId: string,
  messageId: string,
  uploadIds: string[],
) {
  if (!uploadIds.length) return;
  const db = createAdminClient();

  const { data: uploads, error } = await db
    .from("message_attachment_uploads")
    .select("id, message_id")
    .eq("ticket_id", ticketId)
    .in("id", uploadIds);
  if (error) throw ApiError.internal(error.message);
  if ((uploads ?? []).length !== uploadIds.length) {
    throw ApiError.badRequest("One or more attachment uploads were not found");
  }

  const alreadyLinked = (uploads ?? []).find(
    (u) => u.message_id && u.message_id !== messageId,
  );
  if (alreadyLinked) {
    throw ApiError.badRequest("Attachment upload is already linked to a message");
  }

  const { error: updateError } = await db
    .from("message_attachment_uploads")
    .update({ message_id: messageId })
    .eq("ticket_id", ticketId)
    .in("id", uploadIds);
  if (updateError) throw ApiError.internal(updateError.message);
}

export async function loadOutboundAttachments(messageId: string) {
  const db = createAdminClient();

  const { data: uploads, error } = await db
    .from("message_attachment_uploads")
    .select("*")
    .eq("message_id", messageId);
  if (error) throw ApiError.internal(error.message);

  const attachments: Array<{
    filename: string;
    contentType: string;
    content: Buffer;
    uploadId: string;
    storagePath: string;
    sizeBytes: number;
  }> = [];

  for (const upload of uploads ?? []) {
    const { data: blob, error: downloadError } = await db.storage
      .from(ATTACHMENTS_BUCKET)
      .download(upload.storage_path);
    if (downloadError || !blob) {
      console.error("Failed to download staged attachment:", downloadError?.message);
      continue;
    }
    const content = Buffer.from(await blob.arrayBuffer());
    attachments.push({
      filename: upload.filename,
      contentType: upload.content_type,
      content,
      uploadId: upload.id,
      storagePath: upload.storage_path,
      sizeBytes: upload.size_bytes,
    });
  }

  return attachments;
}

export async function finalizeAttachmentUploads(
  ticketId: string,
  messageId: string,
  staged: Array<{
    filename: string;
    contentType: string;
    content: Buffer;
    uploadId: string;
    storagePath: string;
    sizeBytes: number;
  }>,
) {
  if (!staged.length) return;
  const db = createAdminClient();

  for (const att of staged) {
    const destPath = finalPath(ticketId, messageId, att.filename);
    const { error: moveError } = await db.storage
      .from(ATTACHMENTS_BUCKET)
      .move(att.storagePath, destPath);
    if (moveError) {
      console.error("Failed to finalize attachment:", moveError.message);
      continue;
    }

    await persistMessageAttachment({
      ticketId,
      messageId,
      filename: att.filename,
      contentType: att.contentType,
      sizeBytes: att.sizeBytes,
      storagePath: destPath,
    });

    await db
      .from("message_attachment_uploads")
      .delete()
      .eq("id", att.uploadId);
  }
}

export async function getAttachmentSignedUrl(
  messageId: string,
  attachmentId: string,
) {
  const db = createAdminClient();
  const { data: attachment, error } = await db
    .from("attachments")
    .select("id, message_id, storage_path")
    .eq("id", attachmentId)
    .maybeSingle();
  if (error) throw ApiError.internal(error.message);
  if (!attachment || attachment.message_id !== messageId) {
    throw ApiError.notFound("Attachment not found");
  }

  const { data: signed, error: signError } = await db.storage
    .from(ATTACHMENTS_BUCKET)
    .createSignedUrl(attachment.storage_path, 3600);
  if (signError || !signed?.signedUrl) {
    throw ApiError.internal(signError?.message ?? "Failed to create signed URL");
  }

  return signed.signedUrl;
}
