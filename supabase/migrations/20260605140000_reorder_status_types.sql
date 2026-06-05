-- Atomically reorder status_types.position without unique-index conflicts.
CREATE OR REPLACE FUNCTION public.reorder_status_types(ordered_ids uuid[])
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  expected_count int;
BEGIN
  SELECT count(*)::int INTO expected_count FROM public.status_types;

  IF ordered_ids IS NULL OR array_length(ordered_ids, 1) IS DISTINCT FROM expected_count THEN
    RAISE EXCEPTION 'ids must include every status exactly once';
  END IF;

  IF (
    SELECT count(DISTINCT id)
    FROM unnest(ordered_ids) AS wanted(id)
  ) IS DISTINCT FROM expected_count THEN
    RAISE EXCEPTION 'ids must include every status exactly once';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM unnest(ordered_ids) AS wanted(id)
    LEFT JOIN public.status_types AS st ON st.id = wanted.id
    WHERE st.id IS NULL
  ) THEN
    RAISE EXCEPTION 'ids must include every status exactly once';
  END IF;

  PERFORM pg_advisory_xact_lock(hashtext('reorder_status_types'));

  -- Shift every row out of the 0..n-1 range so final assignment cannot collide.
  UPDATE public.status_types AS st
  SET position = st.position + 1000000
  WHERE st.id IS NOT NULL;

  UPDATE public.status_types AS st
  SET position = ord.idx - 1
  FROM (
    SELECT id, ordinality AS idx
    FROM unnest(ordered_ids) WITH ORDINALITY AS t(id)
  ) AS ord
  WHERE st.id = ord.id;
END;
$$;

REVOKE ALL ON FUNCTION public.reorder_status_types(uuid[]) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.reorder_status_types(uuid[]) TO service_role;
