-- Staged outbound attachment uploads: link to message after compose send.
-- Nullable until linkUploadsToMessage runs (upload ids known at send time).
ALTER TABLE public.message_attachment_uploads
  ADD COLUMN IF NOT EXISTS message_id uuid REFERENCES public.messages (id) ON DELETE CASCADE;

CREATE INDEX IF NOT EXISTS message_attachment_uploads_message_id_idx
  ON public.message_attachment_uploads (message_id)
  WHERE message_id IS NOT NULL;

COMMENT ON COLUMN public.message_attachment_uploads.message_id IS
  'Set when outbound message is created; used to load staged files for send.';
