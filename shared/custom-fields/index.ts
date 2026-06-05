export {
  CUSTOM_FIELD_TYPES,
  isOptionListType,
  type CustomFieldType,
  type CustomFieldGroup,
  type CustomFieldDefinition,
  type CustomFieldDefinitionOptions,
  type SelectFieldOptions,
} from "./types";

export {
  CUSTOM_FIELD_TYPE_LIST,
  CUSTOM_FIELD_TYPE_REGISTRY,
  getCustomFieldTypeLabel,
  getCustomFieldTypeMeta,
  type CustomFieldFilterValueMode,
  type CustomFieldTypeMeta,
} from "./registry";

export {
  getCustomFieldFilterOperators,
  usesMultiselectFilterSemantics,
  usesOptionListFilterValues,
} from "./filter-behavior";

export {
  coerceCustomFieldValue,
  isValidFieldKey,
  normalizeSelectOptions,
  parseMultiselectValue,
  parseSelectOptions,
  slugifyLabelToKey,
  validateDefinitionOptions,
  validateShowOpenInTicketForGroup,
  type CoercedCustomFieldValue,
} from "./validation";

export {
  buildContactFieldRows,
  hasCustomFieldDisplayValue,
  hasCustomFieldValue,
  isContactFieldProminent,
  resolveContactFieldVisibility,
  type ContactFieldRow,
} from "./contact-visibility";

export {
  formatCustomFieldDisplayValue,
  formatCustomFieldValue,
  resolveOpenContactFieldsForDisplay,
  type ContactOpenFieldDisplay,
  type CustomFieldFormatMode,
} from "./format";
