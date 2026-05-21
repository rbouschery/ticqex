"use client";

import { Toaster } from "sonner";

export function AppToaster() {
  return (
    <Toaster
      position="top-center"
      richColors
      closeButton
      toastOptions={{
        classNames: {
          toast:
            "rounded-lg border border-zinc-200 bg-white text-zinc-900 shadow-lg dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-50",
          description: "text-zinc-600 dark:text-zinc-400",
          actionButton: "bg-indigo-600 text-white",
          cancelButton: "bg-zinc-100 text-zinc-900 dark:bg-zinc-800 dark:text-zinc-50",
        },
      }}
    />
  );
}
