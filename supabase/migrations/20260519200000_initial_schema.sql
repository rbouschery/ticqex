-- Ticqex initial schema (Phase 0)
-- See docs/DATA-MODEL.md

-- Enums
CREATE TYPE public.user_role AS ENUM ('admin', 'agent');
CREATE TYPE public.ticket_origin AS ENUM ('manual', 'api', 'email');
CREATE TYPE public.message_visibility AS ENUM ('public', 'internal');
CREATE TYPE public.message_author_type AS ENUM ('customer', 'agent', 'system');
CREATE TYPE public.message_channel AS ENUM ('email', 'api', 'admin');
CREATE TYPE public.custom_field_group AS ENUM ('ticket', 'customer');
CREATE TYPE public.custom_field_type AS ENUM (
  'text', 'number', 'date', 'boolean', 'select', 'url', 'json'
);
CREATE TYPE public.custom_field_entity_type AS ENUM ('ticket', 'customer');

-- Staff (extends Supabase Auth)
CREATE TABLE public.users (
  id uuid PRIMARY KEY REFERENCES auth.users (id) ON DELETE CASCADE,
  username text NOT NULL,
  email text NOT NULL,
  role public.user_role NOT NULL DEFAULT 'agent',
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.customers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  username text NOT NULL UNIQUE,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.status_types (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  color text NOT NULL DEFAULT '#6366f1',
  position int NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX status_types_position_unique ON public.status_types (position);

CREATE TABLE public.tags (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL UNIQUE,
  color text NOT NULL DEFAULT '#64748b',
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.tickets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL,
  customer_id uuid NOT NULL REFERENCES public.customers (id) ON DELETE RESTRICT,
  status_id uuid NOT NULL REFERENCES public.status_types (id) ON DELETE RESTRICT,
  assignee_id uuid REFERENCES public.users (id) ON DELETE SET NULL,
  origin public.ticket_origin NOT NULL DEFAULT 'manual',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX tickets_customer_id_idx ON public.tickets (customer_id);
CREATE INDEX tickets_status_id_idx ON public.tickets (status_id);
CREATE INDEX tickets_assignee_id_idx ON public.tickets (assignee_id);
CREATE INDEX tickets_created_at_idx ON public.tickets (created_at);
CREATE INDEX tickets_updated_at_idx ON public.tickets (updated_at);

CREATE TABLE public.ticket_tags (
  ticket_id uuid NOT NULL REFERENCES public.tickets (id) ON DELETE CASCADE,
  tag_id uuid NOT NULL REFERENCES public.tags (id) ON DELETE CASCADE,
  PRIMARY KEY (ticket_id, tag_id)
);

CREATE TABLE public.messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  ticket_id uuid NOT NULL REFERENCES public.tickets (id) ON DELETE CASCADE,
  body text NOT NULL,
  visibility public.message_visibility NOT NULL DEFAULT 'public',
  author_type public.message_author_type NOT NULL,
  author_id uuid,
  channel public.message_channel NOT NULL DEFAULT 'admin',
  email_message_id text,
  email_in_reply_to text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX messages_ticket_id_idx ON public.messages (ticket_id);

CREATE TABLE public.attachments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  message_id uuid NOT NULL REFERENCES public.messages (id) ON DELETE CASCADE,
  filename text NOT NULL,
  content_type text NOT NULL,
  size_bytes int NOT NULL,
  storage_path text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.custom_field_definitions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "group" public.custom_field_group NOT NULL,
  key text NOT NULL,
  label text NOT NULL,
  type public.custom_field_type NOT NULL,
  options jsonb,
  required boolean NOT NULL DEFAULT false,
  position int NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE ("group", key)
);

CREATE TABLE public.custom_field_values (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  field_id uuid NOT NULL REFERENCES public.custom_field_definitions (id) ON DELETE CASCADE,
  entity_type public.custom_field_entity_type NOT NULL,
  entity_id uuid NOT NULL,
  value_text text,
  value_number numeric,
  value_date date,
  value_boolean boolean,
  value_json jsonb,
  UNIQUE (field_id, entity_type, entity_id)
);

CREATE INDEX custom_field_values_field_text_idx
  ON public.custom_field_values (field_id, value_text)
  WHERE value_text IS NOT NULL;

CREATE TABLE public.global_settings (
  id int PRIMARY KEY DEFAULT 1 CHECK (id = 1),
  visible_status_ids uuid[] NOT NULL DEFAULT '{}',
  show_customer_on_ticket boolean NOT NULL DEFAULT true,
  show_assignee_on_ticket boolean NOT NULL DEFAULT true,
  show_body_on_ticket boolean NOT NULL DEFAULT true,
  visible_ticket_field_ids uuid[] NOT NULL DEFAULT '{}',
  visible_customer_field_ids uuid[] NOT NULL DEFAULT '{}',
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.api_keys (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  key_hash text NOT NULL,
  key_prefix text NOT NULL,
  created_by uuid NOT NULL REFERENCES public.users (id) ON DELETE CASCADE,
  last_used_at timestamptz,
  revoked_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.email_threads (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  ticket_id uuid NOT NULL REFERENCES public.tickets (id) ON DELETE CASCADE,
  root_message_id text NOT NULL,
  subject text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Sync auth.users -> public.users on signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.users (id, username, email, role)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data ->> 'username', split_part(NEW.email, '@', 1)),
    NEW.email,
    COALESCE((NEW.raw_app_meta_data ->> 'role')::public.user_role, 'agent')
  );
  RETURN NEW;
END;
$$;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_new_user();

-- updated_at helper
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

CREATE TRIGGER customers_updated_at
  BEFORE UPDATE ON public.customers
  FOR EACH ROW
  EXECUTE FUNCTION public.set_updated_at();

CREATE TRIGGER tickets_updated_at
  BEFORE UPDATE ON public.tickets
  FOR EACH ROW
  EXECUTE FUNCTION public.set_updated_at();

CREATE TRIGGER global_settings_updated_at
  BEFORE UPDATE ON public.global_settings
  FOR EACH ROW
  EXECUTE FUNCTION public.set_updated_at();

-- RLS: enabled on all tables; service role bypasses RLS
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.customers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.status_types ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tags ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tickets ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ticket_tags ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.attachments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.custom_field_definitions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.custom_field_values ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.global_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.api_keys ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.email_threads ENABLE ROW LEVEL SECURITY;

-- Authenticated staff: read-only (Realtime subscriptions in admin UI)
CREATE POLICY users_select_authenticated ON public.users
  FOR SELECT TO authenticated USING (true);

CREATE POLICY customers_select_authenticated ON public.customers
  FOR SELECT TO authenticated USING (true);

CREATE POLICY status_types_select_authenticated ON public.status_types
  FOR SELECT TO authenticated USING (true);

CREATE POLICY tags_select_authenticated ON public.tags
  FOR SELECT TO authenticated USING (true);

CREATE POLICY tickets_select_authenticated ON public.tickets
  FOR SELECT TO authenticated USING (true);

CREATE POLICY ticket_tags_select_authenticated ON public.ticket_tags
  FOR SELECT TO authenticated USING (true);

CREATE POLICY messages_select_authenticated ON public.messages
  FOR SELECT TO authenticated USING (true);

CREATE POLICY attachments_select_authenticated ON public.attachments
  FOR SELECT TO authenticated USING (true);

CREATE POLICY custom_field_definitions_select_authenticated
  ON public.custom_field_definitions
  FOR SELECT TO authenticated USING (true);

CREATE POLICY custom_field_values_select_authenticated ON public.custom_field_values
  FOR SELECT TO authenticated USING (true);

CREATE POLICY global_settings_select_authenticated ON public.global_settings
  FOR SELECT TO authenticated USING (true);

-- api_keys: no direct client access
-- email_threads: staff can read for debugging in admin (optional)
CREATE POLICY email_threads_select_authenticated ON public.email_threads
  FOR SELECT TO authenticated USING (true);

-- Realtime publication for admin board (Phase 4 will subscribe)
ALTER PUBLICATION supabase_realtime ADD TABLE public.tickets;
ALTER PUBLICATION supabase_realtime ADD TABLE public.messages;
ALTER PUBLICATION supabase_realtime ADD TABLE public.status_types;
