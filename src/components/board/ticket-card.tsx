"use client";

import { useState } from "react";
import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import {
  ArrowsLeftRightIcon,
  CopyIcon,
  DotsThreeVerticalIcon,
  TrashIcon,
} from "@phosphor-icons/react";
import { toast } from "sonner";
import { Avatar, AvatarFallback, AvatarGroup } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useOptionalBoardTicketModalContext } from "./board-ticket-modal-context";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { apiFetchText } from "@/lib/api-client";
import { useCopyContextSettings } from "@/hooks/use-ticket-reference-data";
import { cn } from "@/lib/utils";
import {
  TicketDeleteDialog,
  ticketDeleteCopy,
} from "./ticket-delete-dialog";
import {
  CORE_TICKET_FIELD_IDS,
  resolveCoreTicketFieldVisibility,
  type ResolvedTicketFieldLayout,
} from "@shared/ticket-fields";
import type {
  BoardTicket,
  TicketCardBadgeVariant,
  TicketCardSurface,
} from "./types";

function stopCardPointerEvent(e: React.SyntheticEvent) {
  e.stopPropagation();
}

function boardContactLabel(ticket: BoardTicket): string {
  if (!ticket.contact) return "";
  if (ticket.kind === "conversation") {
    const email = ticket.card_surface.chips.find(
      (chip) => chip.fieldId === CORE_TICKET_FIELD_IDS.contact_address,
    )?.value;
    if (email) return email;
  }
  return ticket.contact.username;
}

function mapBadgeVariant(
  variant: TicketCardBadgeVariant | undefined,
): "default" | "outline" | "destructive" | "secondary" {
  if (variant === "warning") return "destructive";
  return variant ?? "default";
}

function CardBadges({
  badges,
  className,
}: {
  badges: TicketCardSurface["badges"];
  className?: string;
}) {
  if (badges.length === 0) return null;

  return (
    <div className={cn("flex shrink-0 flex-wrap justify-end gap-1", className)}>
      {badges.map((badge) => (
        <Badge
          key={badge.label}
          variant={mapBadgeVariant(badge.variant)}
          className="text-[10px]"
        >
          {badge.label}
        </Badge>
      ))}
    </div>
  );
}

function TicketCardActions({
  ticket,
  statusId,
  sortable,
  onOpen,
  onDeleted,
}: {
  ticket: BoardTicket;
  statusId?: string;
  sortable: boolean;
  onOpen: () => void;
  onDeleted?: (ticketId: string) => void;
}) {
  const boardContext = useOptionalBoardTicketModalContext();
  const copyContextSettingsQuery = useCopyContextSettings();
  const showCopyContext = copyContextSettingsQuery.data?.visible ?? true;
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [moving, setMoving] = useState(false);
  const deleteCopy = ticketDeleteCopy(ticket.kind);

  const canMove =
    statusId != null &&
    boardContext != null &&
    boardContext.statuses.length > 0;
  const moveDestinations = canMove
    ? boardContext.statuses.filter((status) => status.id !== statusId)
    : [];
  const hasMenuItemsBeforeDelete =
    (canMove && moveDestinations.length > 0) || showCopyContext;
  const showActionsMenu = hasMenuItemsBeforeDelete || onDeleted != null;

  function confirmDelete() {
    if (!onDeleted) return;
    setDeleteOpen(false);
    onDeleted(ticket.id);
  }

  async function copyContext() {
    try {
      const text = await apiFetchText(`/api/v1/tickets/${ticket.id}/context`);
      await navigator.clipboard.writeText(text);
      toast.success("Context copied");
    } catch {
      toast.error("Could not copy context", {
        description: "Failed to copy ticket context to clipboard.",
      });
    }
  }

  async function moveToStatus(toStatusId: string) {
    if (!canMove || !statusId || toStatusId === statusId) return;
    setMoving(true);
    try {
      await boardContext.onStatusChange(ticket.id, statusId, toStatusId);
    } catch {
      boardContext.onBoardChange();
      toast.error("Could not move ticket", {
        description: "The board was refreshed to match the server.",
      });
    } finally {
      setMoving(false);
    }
  }

  return (
    <>
      <div
        className={cn(
          "flex shrink-0 items-center gap-0.5",
          sortable && "pointer-events-auto",
        )}
        onPointerDown={stopCardPointerEvent}
        onClick={stopCardPointerEvent}
      >
        <Button
          type="button"
          variant="secondary"
          size="xs"
          className="cursor-pointer"
          aria-label="Open ticket"
          onClick={onOpen}
        >
          Open
        </Button>
        {showActionsMenu ? (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                type="button"
                variant="ghost"
                size="icon-sm"
                className="text-muted-foreground hover:text-foreground"
                aria-label="Ticket actions"
                disabled={moving}
              >
                <DotsThreeVerticalIcon />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="min-w-44">
              {canMove && moveDestinations.length > 0 ? (
                <DropdownMenuSub>
                  <DropdownMenuSubTrigger disabled={moving}>
                    <ArrowsLeftRightIcon />
                    Move to…
                  </DropdownMenuSubTrigger>
                  <DropdownMenuSubContent>
                    {moveDestinations.map((status) => (
                      <DropdownMenuItem
                        key={status.id}
                        disabled={moving}
                        onClick={() => void moveToStatus(status.id)}
                      >
                        <span
                          className="size-2 shrink-0 rounded-full"
                          style={{ backgroundColor: status.color }}
                        />
                        {status.name}
                      </DropdownMenuItem>
                    ))}
                  </DropdownMenuSubContent>
                </DropdownMenuSub>
              ) : null}
              {showCopyContext ? (
                <DropdownMenuItem onClick={() => void copyContext()}>
                  <CopyIcon />
                  Copy context
                </DropdownMenuItem>
              ) : null}
              {hasMenuItemsBeforeDelete && onDeleted != null ? (
                <DropdownMenuSeparator />
              ) : null}
              {onDeleted ? (
                <DropdownMenuItem
                  variant="destructive"
                  onClick={() => setDeleteOpen(true)}
                >
                  <TrashIcon />
                  {deleteCopy.label}
                </DropdownMenuItem>
              ) : null}
            </DropdownMenuContent>
          </DropdownMenu>
        ) : null}
      </div>
      {onDeleted ? (
        <TicketDeleteDialog
          open={deleteOpen}
          kind={ticket.kind}
          onOpenChange={setDeleteOpen}
          onConfirmDelete={confirmDelete}
        />
      ) : null}
    </>
  );
}

function TicketCardContent({
  ticket,
  statusId,
  sortable,
  showActions,
  onOpen,
  onDeleted,
  fieldLayout,
}: {
  ticket: BoardTicket;
  statusId?: string;
  sortable: boolean;
  showActions: boolean;
  onOpen: () => void;
  onDeleted?: (ticketId: string) => void;
  fieldLayout?: ResolvedTicketFieldLayout | null;
}) {
  const surface = ticket.card_surface;
  const preview = surface.preview;
  const visibleFields = resolveCoreTicketFieldVisibility(fieldLayout, "card");
  const showContact = visibleFields[CORE_TICKET_FIELD_IDS.contact];
  const showAssignee = visibleFields[CORE_TICKET_FIELD_IDS.assignee];
  const showTags = visibleFields[CORE_TICKET_FIELD_IDS.tags];
  const showPreview = visibleFields[CORE_TICKET_FIELD_IDS.preview];

  return (
    <Card size="sm" className={cn("py-0", sortable && "pointer-events-none")}>
      <CardContent className="space-y-2 py-3">
        <div className="flex items-baseline gap-2">
          <h3 className="min-w-0 flex-1 text-sm font-medium leading-none text-foreground">
            {ticket.title}
          </h3>
          {showActions ? (
            <TicketCardActions
              ticket={ticket}
              statusId={statusId}
              sortable={sortable}
              onOpen={onOpen}
              onDeleted={onDeleted}
            />
          ) : (
            <CardBadges badges={surface.badges} />
          )}
        </div>
        {showActions && surface.badges.length > 0 ? (
          <CardBadges badges={surface.badges} className="justify-start" />
        ) : null}
        {surface.warning_badges.length > 0 && (
          <div className="flex flex-wrap gap-1">
            {surface.warning_badges.map((badge) => (
              <Badge
                key={badge.label}
                variant={mapBadgeVariant(badge.variant)}
                className="text-[10px]"
              >
                {badge.label}
              </Badge>
            ))}
          </div>
        )}
        {showPreview && preview && (
          <p className="line-clamp-2 text-xs text-muted-foreground">{preview}</p>
        )}
        {surface.chips.length > 0 && (
          <div className="flex flex-wrap gap-1">
            {surface.chips.map((chip) => (
              <Badge
                key={`${chip.fieldId ?? chip.sourceKey ?? chip.label}:${chip.value}`}
                variant="secondary"
                className="text-[10px]"
              >
                {chip.label}: {chip.value}
              </Badge>
            ))}
          </div>
        )}
        <div className="flex items-center justify-between">
          <AvatarGroup>
            {showContact && ticket.contact && (
              <Tooltip>
                <TooltipTrigger asChild>
                  <span
                    className={cn(
                      "inline-flex",
                      sortable && "pointer-events-auto",
                    )}
                  >
                    <Avatar size="sm">
                      <AvatarFallback className="bg-primary/10 text-[10px] text-primary">
                        {ticket.contact.initials}
                      </AvatarFallback>
                    </Avatar>
                  </span>
                </TooltipTrigger>
                <TooltipContent
                  side="top"
                  className={cn(
                    ticket.contact_open_fields.length > 0 &&
                      "flex max-w-xs flex-col items-start gap-1 text-left",
                  )}
                >
                  <span>{boardContactLabel(ticket)}</span>
                  {ticket.contact_open_fields.map((field) => (
                    <span
                      key={field.label}
                      className="text-background/80"
                    >
                      {field.label}: {field.value}
                    </span>
                  ))}
                </TooltipContent>
              </Tooltip>
            )}
            {showAssignee && ticket.assignee && (
              <Avatar size="sm" title={ticket.assignee.username}>
                <AvatarFallback className="bg-secondary text-[10px] text-secondary-foreground">
                  {ticket.assignee.initials}
                </AvatarFallback>
              </Avatar>
            )}
          </AvatarGroup>
          <div className="flex gap-1">
            {showTags &&
              ticket.tags.slice(0, 2).map((tag) => (
              <Badge
                key={tag.id}
                className="text-[10px] text-white"
                style={{ backgroundColor: tag.color }}
              >
                {tag.name}
              </Badge>
            ))}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

export function TicketCard({
  ticket,
  statusId,
  onClick,
  onDeleted,
  dragOverlay = false,
  sortable = false,
  fieldLayout,
}: {
  ticket: BoardTicket;
  statusId?: string;
  onClick: () => void;
  onDeleted?: (ticketId: string) => void;
  dragOverlay?: boolean;
  sortable?: boolean;
  fieldLayout?: ResolvedTicketFieldLayout | null;
}) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({
    id: ticket.id,
    disabled: dragOverlay || !sortable,
  });

  const style = transform
    ? {
        transform: CSS.Transform.toString(transform),
        transition,
      }
    : undefined;

  const showActions = !dragOverlay;

  return (
    <div
      ref={dragOverlay ? undefined : setNodeRef}
      style={style}
      {...(dragOverlay || !sortable ? {} : { ...attributes, ...listeners })}
      onClick={!dragOverlay ? onClick : undefined}
      className={cn(
        "relative rounded-xl outline-none focus:outline-none focus-visible:outline-none",
        sortable && !dragOverlay && "cursor-grab touch-none active:cursor-grabbing",
        !sortable && !dragOverlay && "cursor-pointer",
        isDragging && !dragOverlay && "opacity-0",
        dragOverlay && "shadow-lg",
      )}
    >
      {ticket.unread_count > 0 && (
        <Badge
          className="absolute -right-1.5 -top-1.5 z-10 h-5 min-w-5 justify-center border-2 border-card bg-red-600 px-1 text-[10px] font-bold text-white hover:bg-red-600"
          aria-label={`${ticket.unread_count} unread messages`}
        >
          {ticket.unread_count > 99 ? "99+" : ticket.unread_count}
        </Badge>
      )}
      <TicketCardContent
        ticket={ticket}
        statusId={statusId}
        sortable={sortable && !dragOverlay}
        showActions={showActions}
        onOpen={onClick}
        onDeleted={onDeleted}
        fieldLayout={fieldLayout}
      />
    </div>
  );
}
