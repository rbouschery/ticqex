-- Required app defaults (statuses + global_settings). Safe to re-run.
-- Admin user: scripts/seed.ts via `pnpm db:seed-admin` (optional).

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
  default_inbound_status_id,
  show_customer_on_ticket,
  show_assignee_on_ticket,
  show_body_on_ticket
)
SELECT
  1,
  COALESCE(
    (SELECT array_agg(id ORDER BY position) FROM public.status_types),
    '{}'::uuid[]
  ),
  (SELECT id FROM public.status_types ORDER BY position ASC LIMIT 1),
  true,
  true,
  true
WHERE NOT EXISTS (SELECT 1 FROM public.global_settings WHERE id = 1);
