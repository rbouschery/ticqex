ALTER TABLE public.messages
  ADD COLUMN resend_inbound_id text;

CREATE UNIQUE INDEX messages_resend_inbound_id_key
  ON public.messages (resend_inbound_id)
  WHERE resend_inbound_id IS NOT NULL;

CREATE UNIQUE INDEX messages_email_message_id_inbound_key
  ON public.messages (email_message_id)
  WHERE email_message_id IS NOT NULL
    AND email_message_id NOT LIKE '%@inbound>';
