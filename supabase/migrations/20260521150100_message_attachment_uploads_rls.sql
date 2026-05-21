-- Tighten RLS on staged outbound attachment uploads.
-- Server writes use service role (bypasses RLS); client should never have broad CRUD.

DROP POLICY IF EXISTS message_attachment_uploads_authenticated ON public.message_attachment_uploads;

CREATE POLICY message_attachment_uploads_select_staff ON public.message_attachment_uploads
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.users u
      WHERE u.id = auth.uid()
        AND u.role IN ('admin', 'agent')
    )
    AND (
      uploaded_by = auth.uid()
      OR EXISTS (
        SELECT 1
        FROM public.users u
        WHERE u.id = auth.uid()
          AND u.role = 'admin'
      )
      OR EXISTS (
        SELECT 1
        FROM public.tickets t
        WHERE t.id = message_attachment_uploads.ticket_id
          AND t.assignee_id = auth.uid()
      )
    )
  );
