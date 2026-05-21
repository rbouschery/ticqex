-- Task tickets use tickets.body only; conversations use messages.

CREATE OR REPLACE FUNCTION public.reject_messages_on_task_tickets()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM public.tickets t
    WHERE t.id = NEW.ticket_id
      AND t.kind = 'task'
  ) THEN
    RAISE EXCEPTION 'task tickets cannot have messages';
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER messages_reject_task_ticket
  BEFORE INSERT ON public.messages
  FOR EACH ROW
  EXECUTE FUNCTION public.reject_messages_on_task_tickets();
