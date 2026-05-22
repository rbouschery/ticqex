"use client";

import { useCallback, useEffect, useRef, type RefObject } from "react";
import { createClient } from "@/lib/supabase/client";

const DEBOUNCE_MS = 400;

function useDebouncedRefresh(
  onRefresh: () => void,
  mutedUntilRef?: RefObject<number>,
) {
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const onRefreshRef = useRef(onRefresh);
  const mutedUntilRefStable = useRef(mutedUntilRef);

  useEffect(() => {
    onRefreshRef.current = onRefresh;
  }, [onRefresh]);

  useEffect(() => {
    mutedUntilRefStable.current = mutedUntilRef;
  }, [mutedUntilRef]);

  useEffect(() => {
    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
    };
  }, []);

  return useCallback(() => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
    }
    timeoutRef.current = setTimeout(() => {
      const mutedUntil = mutedUntilRefStable.current?.current ?? 0;
      if (Date.now() < mutedUntil) return;
      onRefreshRef.current();
    }, DEBOUNCE_MS);
  }, []);
}

export function useBoardRealtime(
  onRefresh: () => void,
  mutedUntilRef?: RefObject<number>,
) {
  const scheduleRefresh = useDebouncedRefresh(onRefresh, mutedUntilRef);

  useEffect(() => {
    const supabase = createClient();

    const channel = supabase
      .channel("board")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "tickets" },
        scheduleRefresh,
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "messages" },
        scheduleRefresh,
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "message_reads" },
        scheduleRefresh,
      )
      .subscribe();

    return () => {
      void supabase.removeChannel(channel);
    };
  }, [scheduleRefresh]);
}

export function useTicketRealtime(ticketId: string, onRefresh: () => void) {
  const scheduleRefresh = useDebouncedRefresh(onRefresh);

  useEffect(() => {
    const supabase = createClient();
    const ticketFilter = `id=eq.${ticketId}`;
    const messageFilter = `ticket_id=eq.${ticketId}`;

    const channel = supabase
      .channel(`ticket:${ticketId}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "messages",
          filter: messageFilter,
        },
        scheduleRefresh,
      )
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "tickets",
          filter: ticketFilter,
        },
        scheduleRefresh,
      )
      .subscribe();

    return () => {
      void supabase.removeChannel(channel);
    };
  }, [ticketId, scheduleRefresh]);
}
