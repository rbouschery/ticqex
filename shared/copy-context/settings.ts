import { z } from "zod";

export const copyContextSettingsSchema = z.object({
  visible: z.boolean(),
  append_contact: z.boolean(),
  append_contact_custom_fields: z.boolean(),
  append_custom_fields: z.boolean(),
  prepend_text: z.string(),
});

export type CopyContextSettings = z.infer<typeof copyContextSettingsSchema>;

export const copyContextSettingsPatchSchema = copyContextSettingsSchema.partial();

export const DEFAULT_COPY_CONTEXT_SETTINGS: CopyContextSettings = {
  visible: true,
  append_contact: true,
  append_contact_custom_fields: true,
  append_custom_fields: true,
  prepend_text: "",
};

export function resolveCopyContextSettings(
  raw: unknown,
): CopyContextSettings {
  const parsed = copyContextSettingsSchema.safeParse(raw);
  if (parsed.success) return parsed.data;

  if (raw && typeof raw === "object" && !Array.isArray(raw)) {
    const partial = copyContextSettingsPatchSchema.safeParse(raw);
    if (partial.success) {
      return { ...DEFAULT_COPY_CONTEXT_SETTINGS, ...partial.data };
    }
  }

  return { ...DEFAULT_COPY_CONTEXT_SETTINGS };
}

export function mergeCopyContextPatch(
  existing: unknown,
  patch: Partial<CopyContextSettings>,
): CopyContextSettings {
  return resolveCopyContextSettings({
    ...resolveCopyContextSettings(existing),
    ...patch,
  });
}
