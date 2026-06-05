-- Optional demo tickets/contacts/tags (included in `pnpm db:reset`).

INSERT INTO public.contacts (username)
VALUES ('demo@example.com');

INSERT INTO public.tags (name, color)
VALUES ('bug', '#ef4444'), ('feature', '#8b5cf6');

INSERT INTO public.tickets (
  title,
  kind,
  body,
  contact_id,
  status_id,
  origin
)
SELECT
  'Welcome to ticqex',
  'task',
  'This is a sample task on the board. Edit the description in the ticket modal.',
  c.id,
  s.id,
  'manual'
FROM public.contacts c
CROSS JOIN public.status_types s
WHERE c.username = 'demo@example.com'
  AND s.name = 'New'
LIMIT 1;

INSERT INTO public.tickets (
  title,
  kind,
  channel,
  contact_address,
  contact_id,
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
FROM public.contacts c
CROSS JOIN public.status_types s
WHERE c.username = 'demo@example.com'
  AND s.name = 'In Process'
LIMIT 1;

INSERT INTO public.messages (ticket_id, body, visibility, author_type, channel)
SELECT
  t.id,
  'Thanks for trying ticqex — this is a sample contact message.',
  'public',
  'contact',
  'admin'
FROM public.tickets t
WHERE t.title = 'Sample email conversation'
LIMIT 1;

INSERT INTO public.ticket_tags (ticket_id, tag_id)
SELECT t.id, tag.id
FROM public.tickets t
CROSS JOIN public.tags tag
WHERE t.title = 'Welcome to ticqex'
  AND tag.name = 'feature'
LIMIT 1;
