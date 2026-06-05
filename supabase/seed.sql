-- Runs on `pnpm db:reset`: bootstrap (required) + optional demo data.
-- Admin user is separate: `pnpm db:seed-admin` (optional).
-- Keep this as plain SQL. Supabase seed execution does not support psql
-- include meta-commands in all environments.

-- Required app defaults (statuses + global_settings). Safe to re-run.
INSERT INTO public.status_types (name, color, position)
SELECT v.name, v.color, v.position
FROM (
  VALUES
    ('New', '#3b82f6', 0),
    ('In Process', '#f59e0b', 1),
    ('Done', '#22c55e', 2)
) AS v(name, color, position)
WHERE NOT EXISTS (SELECT 1 FROM public.status_types);

INSERT INTO public.global_settings (
  id,
  visible_status_ids,
  default_inbound_status_id
)
SELECT
  1,
  COALESCE(
    (SELECT array_agg(id ORDER BY position) FROM public.status_types),
    '{}'::uuid[]
  ),
  (SELECT id FROM public.status_types ORDER BY position ASC LIMIT 1)
WHERE NOT EXISTS (SELECT 1 FROM public.global_settings WHERE id = 1);

-- Optional demo tickets/contacts/tags.
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
  'Thanks for trying ticqex - this is a sample contact message.',
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
