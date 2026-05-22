export {
  FILTER_OPERATORS,
  SCALAR_FILTER_FIELDS,
  ticketFilterConditionSchema,
  ticketFilterSchema,
  normalizeCondition,
  normalizeTicketFilter,
  isTicketFilterActive,
  serializeTicketFilter,
  upsertFilterCondition,
  removeFilterCondition,
  type FilterOperator,
  type ScalarFilterField,
  type TicketFilterCondition,
  type TicketFilter,
} from "./schema";

export {
  ticketMatchesFilter,
  matchesScalar,
  matchesCustomField,
  evaluateCondition,
  type TicketFilterMatchTicket,
} from "./evaluate";

export {
  formatOperatorLabel,
  formatFilterConditionLabel,
  getScalarOperators,
  getTagOperators,
  getUnreadOperators,
  getCustomFieldOperators,
  operatorNeedsValue,
  operatorNeedsValues,
} from "./labels";
