-- Remove internal notes (feature dropped)
DELETE FROM public.messages WHERE visibility = 'internal';
