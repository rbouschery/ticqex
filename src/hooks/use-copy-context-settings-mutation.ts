"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  mergeCopyContextPatch,
  type CopyContextSettings,
} from "@shared/copy-context";
import { apiFetch } from "@/lib/api-client";
import { adminSettingsQueryKey } from "@/hooks/use-admin-settings";
import { copyContextSettingsQueryKey } from "@/hooks/use-ticket-reference-data";

export function usePatchCopyContextSettings() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (patch: Partial<CopyContextSettings>) => {
      await apiFetch("/api/v1/settings", {
        method: "PATCH",
        body: JSON.stringify({ copy_context: patch }),
      });
    },
    onMutate: async (patch) => {
      await queryClient.cancelQueries({ queryKey: copyContextSettingsQueryKey });

      const previous = queryClient.getQueryData<CopyContextSettings>(
        copyContextSettingsQueryKey,
      );

      queryClient.setQueryData<CopyContextSettings>(
        copyContextSettingsQueryKey,
        (current) => mergeCopyContextPatch(current, patch),
      );

      return { previous };
    },
    onError: (_error, _patch, context) => {
      if (context?.previous !== undefined) {
        queryClient.setQueryData(
          copyContextSettingsQueryKey,
          context.previous,
        );
      }
      toast.error("Could not save copy context setting");
    },
    onSettled: () => {
      void queryClient.invalidateQueries({ queryKey: copyContextSettingsQueryKey });
      void queryClient.invalidateQueries({ queryKey: adminSettingsQueryKey });
    },
  });
}
