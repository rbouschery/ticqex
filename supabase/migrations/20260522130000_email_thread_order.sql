-- Conversation thread display order in ticket modal (oldest-first = chat-style, newest-first = inbox-style)
ALTER TABLE public.global_settings
  ADD COLUMN IF NOT EXISTS email_thread_order text NOT NULL DEFAULT 'oldest_first'
  CHECK (email_thread_order IN ('oldest_first', 'newest_first'));
