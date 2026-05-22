-- Per-user manual ticket order within each board lane (status).

CREATE TABLE public.board_lane_orders (
  user_id uuid NOT NULL REFERENCES public.users (id) ON DELETE CASCADE,
  status_id uuid NOT NULL REFERENCES public.status_types (id) ON DELETE CASCADE,
  ticket_ids uuid[] NOT NULL DEFAULT '{}',
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, status_id)
);

CREATE INDEX board_lane_orders_user_id_idx ON public.board_lane_orders (user_id);

ALTER TABLE public.board_lane_orders ENABLE ROW LEVEL SECURITY;

CREATE POLICY board_lane_orders_select_authenticated ON public.board_lane_orders
  FOR SELECT TO authenticated USING (user_id = auth.uid());

CREATE POLICY board_lane_orders_insert_authenticated ON public.board_lane_orders
  FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());

CREATE POLICY board_lane_orders_update_authenticated ON public.board_lane_orders
  FOR UPDATE TO authenticated USING (user_id = auth.uid());

CREATE POLICY board_lane_orders_delete_authenticated ON public.board_lane_orders
  FOR DELETE TO authenticated USING (user_id = auth.uid());
