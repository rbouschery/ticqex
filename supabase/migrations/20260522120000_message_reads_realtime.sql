-- Realtime for read-state changes → board unread badges sync across tabs
ALTER PUBLICATION supabase_realtime ADD TABLE public.message_reads;
