ALTER TABLE public.custom_field_definitions
  ADD COLUMN IF NOT EXISTS show_open_in_ticket boolean NOT NULL DEFAULT false;
