-- Per-user read state for incoming (customer) messages

CREATE TABLE public.message_reads (
  user_id uuid NOT NULL REFERENCES public.users (id) ON DELETE CASCADE,
  message_id uuid NOT NULL REFERENCES public.messages (id) ON DELETE CASCADE,
  read_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, message_id)
);

CREATE INDEX message_reads_user_id_idx ON public.message_reads (user_id);
CREATE INDEX message_reads_message_id_idx ON public.message_reads (message_id);

CREATE INDEX messages_ticket_id_created_at_idx
  ON public.messages (ticket_id, created_at);

ALTER TABLE public.message_reads ENABLE ROW LEVEL SECURITY;

CREATE POLICY message_reads_select_authenticated ON public.message_reads
  FOR SELECT TO authenticated USING (user_id = auth.uid());
