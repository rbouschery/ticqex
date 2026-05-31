"use client";

import { useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { EmailDeliveryStatus, MessageRow } from "./types";
import { isEmailMessage } from "./email-utils";

const DELIVERY_VARIANTS: Record<
  EmailDeliveryStatus,
  { label: string; className: string }
> = {
  sent: { label: "Sent", className: "" },
  delivered: {
    label: "Delivered",
    className: "border-emerald-500/30 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400",
  },
  bounced: {
    label: "Bounced",
    className: "border-destructive/30 bg-destructive/10 text-destructive",
  },
  failed: {
    label: "Failed",
    className: "border-destructive/30 bg-destructive/10 text-destructive",
  },
  pending: {
    label: "Pending",
    className: "border-amber-500/30 bg-amber-500/10 text-amber-600 dark:text-amber-400",
  },
  draft: {
    label: "Draft",
    className: "border-muted-foreground/30 bg-muted/60 text-muted-foreground",
  },
};

function DeliveryBadge({ status }: { status: string }) {
  const key = status.toLowerCase() as EmailDeliveryStatus;
  const style = DELIVERY_VARIANTS[key] ?? DELIVERY_VARIANTS.pending;
  return (
    <Badge variant="outline" className={cn("text-[10px] uppercase", style.className)}>
      {style.label}
    </Badge>
  );
}

function formatAddressList(addrs?: string[]): string {
  if (!addrs?.length) return "—";
  return addrs.join(", ");
}

export function EmailMessageHeader({
  message,
  isOutbound,
}: {
  message: MessageRow;
  isOutbound: boolean;
}) {
  const [expanded, setExpanded] = useState(false);
  const isEmail = isEmailMessage(message);

  const showDelivery =
    isOutbound && isEmail && Boolean(message.email_delivery_status);

  return (
    <div className="mb-2">
      <div className="flex flex-wrap items-center gap-1.5">
        <Badge
          variant="outline"
          className={cn(
            "text-[10px] uppercase",
            isEmail && "border-primary/30 bg-primary/10 text-primary",
          )}
        >
          {isEmail ? "Email" : "Message"}
        </Badge>

        {showDelivery && message.email_delivery_status && (
          <DeliveryBadge status={message.email_delivery_status} />
        )}

        {isEmail && (
          <Button
            type="button"
            variant="link"
            size="xs"
            onClick={(e) => {
              e.stopPropagation();
              setExpanded((v) => !v);
            }}
          >
            {expanded ? "Hide headers" : "Show headers"}
          </Button>
        )}
      </div>

      {isEmail && expanded && (
        <dl className="mt-2 space-y-1 rounded-lg border border-border bg-card/60 px-2 py-1.5 text-[11px]">
          {message.email_from && (
            <div className="grid grid-cols-[3.5rem_1fr] gap-x-2">
              <dt className="text-muted-foreground">From</dt>
              <dd className="break-all text-foreground">{message.email_from}</dd>
            </div>
          )}
          <div className="grid grid-cols-[3.5rem_1fr] gap-x-2">
            <dt className="text-muted-foreground">To</dt>
            <dd className="break-all text-foreground">
              {formatAddressList(message.email_to)}
            </dd>
          </div>
          {(message.email_cc?.length ?? 0) > 0 && (
            <div className="grid grid-cols-[3.5rem_1fr] gap-x-2">
              <dt className="text-muted-foreground">Cc</dt>
              <dd className="break-all text-foreground">
                {formatAddressList(message.email_cc)}
              </dd>
            </div>
          )}
          {message.email_subject && (
            <div className="grid grid-cols-[3.5rem_1fr] gap-x-2">
              <dt className="text-muted-foreground">Subject</dt>
              <dd className="break-all text-foreground">{message.email_subject}</dd>
            </div>
          )}
        </dl>
      )}
    </div>
  );
}
