-- messages: email metadata + HTML + delivery tracking
ALTER TABLE public.messages ADD COLUMN IF NOT EXISTS email_from text;
ALTER TABLE public.messages ADD COLUMN IF NOT EXISTS email_to text[] NOT NULL DEFAULT '{}';
ALTER TABLE public.messages ADD COLUMN IF NOT EXISTS email_cc text[] NOT NULL DEFAULT '{}';
ALTER TABLE public.messages ADD COLUMN IF NOT EXISTS email_subject text;
ALTER TABLE public.messages ADD COLUMN IF NOT EXISTS email_body_html text;
ALTER TABLE public.messages ADD COLUMN IF NOT EXISTS email_delivery_status text;
ALTER TABLE public.messages ADD COLUMN IF NOT EXISTS resend_outbound_id text;

CREATE INDEX IF NOT EXISTS messages_resend_outbound_id_idx
  ON public.messages (resend_outbound_id)
  WHERE resend_outbound_id IS NOT NULL;

-- global_settings: agent signature appended to outbound replies
ALTER TABLE public.global_settings ADD COLUMN IF NOT EXISTS email_signature text NOT NULL DEFAULT '';

-- canned response snippets
CREATE TABLE IF NOT EXISTS public.email_snippets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL,
  body text NOT NULL,
  created_by uuid REFERENCES public.users (id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.email_snippets ENABLE ROW LEVEL SECURITY;
CREATE POLICY email_snippets_select_authenticated ON public.email_snippets FOR SELECT TO authenticated USING (true);
CREATE POLICY email_snippets_write_admin ON public.email_snippets FOR ALL TO authenticated USING (
  EXISTS (SELECT 1 FROM public.users u WHERE u.id = auth.uid() AND u.role = 'admin')
);

-- staged outbound attachment uploads (message_id filled after send)
CREATE TABLE IF NOT EXISTS public.message_attachment_uploads (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  ticket_id uuid NOT NULL REFERENCES public.tickets (id) ON DELETE CASCADE,
  filename text NOT NULL,
  content_type text NOT NULL,
  size_bytes int NOT NULL,
  storage_path text NOT NULL,
  uploaded_by uuid REFERENCES public.users (id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.message_attachment_uploads ENABLE ROW LEVEL SECURITY;
CREATE POLICY message_attachment_uploads_authenticated ON public.message_attachment_uploads FOR ALL TO authenticated USING (true);

CREATE INDEX IF NOT EXISTS message_attachment_uploads_ticket_id_idx
  ON public.message_attachment_uploads (ticket_id);
