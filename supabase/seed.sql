-- Default statuses and sample data (run via supabase db reset / seed)
-- Admin user is created by scripts/seed.ts (requires auth admin API)

INSERT INTO public.status_types (name, color, position)
VALUES
  ('New', '#3b82f6', 0),
  ('In Process', '#f59e0b', 1),
  ('Done', '#22c55e', 2);

INSERT INTO public.global_settings (
  id,
  visible_status_ids,
  show_customer_on_ticket,
  show_assignee_on_ticket,
  show_body_on_ticket
)
SELECT
  1,
  array_agg(id ORDER BY position),
  true,
  true,
  true
FROM public.status_types;

INSERT INTO public.customers (username)
VALUES ('demo@example.com');

INSERT INTO public.tags (name, color)
VALUES ('bug', '#ef4444'), ('feature', '#8b5cf6');

INSERT INTO public.tickets (
  title,
  kind,
  body,
  customer_id,
  status_id,
  origin
)
SELECT
  'Welcome to Ticqex',
  'task',
  'This is a sample task on the board. Edit the description in the ticket modal.',
  c.id,
  s.id,
  'manual'
FROM public.customers c
CROSS JOIN public.status_types s
WHERE c.username = 'demo@example.com'
  AND s.name = 'New'
LIMIT 1;

INSERT INTO public.tickets (
  title,
  kind,
  channel,
  contact_address,
  customer_id,
  status_id,
  origin
)
SELECT
  'Sample email conversation',
  'conversation',
  'email',
  'demo@example.com',
  c.id,
  s.id,
  'manual'
FROM public.customers c
CROSS JOIN public.status_types s
WHERE c.username = 'demo@example.com'
  AND s.name = 'In Process'
LIMIT 1;

INSERT INTO public.messages (ticket_id, body, visibility, author_type, channel)
SELECT
  t.id,
  'Thanks for trying Ticqex — this is a sample customer message.',
  'public',
  'customer',
  'admin'
FROM public.tickets t
WHERE t.title = 'Sample email conversation'
LIMIT 1;

INSERT INTO public.ticket_tags (ticket_id, tag_id)
SELECT t.id, tag.id
FROM public.tickets t
CROSS JOIN public.tags tag
WHERE t.title = 'Welcome to Ticqex'
  AND tag.name = 'feature'
LIMIT 1;
