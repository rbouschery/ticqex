export type BoardLane = {
  status: { id: string; name: string; color: string };
  tickets: BoardTicket[];
};

export type BoardTicket = {
  id: string;
  title: string;
  preview: string;
  customer: { username: string; initials: string } | null;
  assignee: { username: string; initials: string } | null;
  custom_fields: Record<string, unknown>;
  tags: { id: string; name: string; color: string }[];
  updated_at: string;
  unread_count: number;
};

export type TicketDetail = BoardTicket & {
  origin: string;
  customer_id: string;
  status_id: string;
  assignee_id: string | null;
  status: { id: string; name: string; color: string } | null;
  messages: MessageRow[];
};

export type MessageRow = {
  id: string;
  body: string;
  visibility: "public" | "internal";
  author_type: string;
  author_id: string | null;
  channel: string;
  created_at: string;
  read?: boolean;
};
