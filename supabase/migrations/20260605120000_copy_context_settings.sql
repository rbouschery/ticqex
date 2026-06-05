ALTER TABLE public.global_settings
  ADD COLUMN IF NOT EXISTS copy_context jsonb NOT NULL DEFAULT '{
    "visible": true,
    "append_contact": true,
    "append_contact_custom_fields": true,
    "append_custom_fields": true,
    "prepend_text": ""
  }'::jsonb;
