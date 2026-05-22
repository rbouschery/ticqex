/**
 * Apply a reorder of visible tickets into a full lane order, keeping
 * filtered-out tickets in their original relative slots.
 */
export function mergeVisibleLaneOrder(
  fullOrder: string[],
  visibleTicketIds: string[],
  reorderedVisibleIds: string[],
): string[] {
  const visibleSet = new Set(visibleTicketIds);
  const reordered = [...reorderedVisibleIds];
  let index = 0;

  return fullOrder.map((id) => {
    if (!visibleSet.has(id)) return id;
    return reordered[index++] ?? id;
  });
}

/** Append any visible ids missing from fullOrder (new tickets). */
export function appendMissingVisibleIds(
  order: string[],
  visibleTicketIds: string[],
): string[] {
  const seen = new Set(order);
  const next = [...order];
  for (const id of visibleTicketIds) {
    if (!seen.has(id)) next.push(id);
  }
  return next;
}

export function mergeFilteredLaneOrder(
  fullOrder: string[],
  visibleTicketIds: string[],
  reorderedVisibleIds: string[],
): string[] {
  const base =
    fullOrder.length > 0
      ? fullOrder
      : appendMissingVisibleIds([], visibleTicketIds);
  const withMissing = appendMissingVisibleIds(base, visibleTicketIds);
  return mergeVisibleLaneOrder(
    withMissing,
    visibleTicketIds,
    reorderedVisibleIds,
  );
}

/** Like mergeFilteredLaneOrder but drops removed tickets from the full order first. */
export function mergeFilteredLaneOrderWithRemoval(
  fullOrder: string[],
  visibleTicketIds: string[],
  reorderedVisibleIds: string[],
  removedTicketIds: string[],
): string[] {
  const removed = new Set(removedTicketIds);
  const withoutRemoved = fullOrder.filter((id) => !removed.has(id));
  const visibleDomain = visibleTicketIds.filter((id) => !removed.has(id));
  return mergeFilteredLaneOrder(
    withoutRemoved,
    visibleDomain,
    reorderedVisibleIds,
  );
}
