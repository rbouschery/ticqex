"use client";

import { useState } from "react";
import { toast } from "sonner";
import {
  resolveCopyContextSettings,
  type CopyContextSettings,
} from "@shared/copy-context";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import { usePatchCopyContextSettings } from "@/hooks/use-copy-context-settings-mutation";
import { useCopyContextSettings } from "@/hooks/use-ticket-reference-data";

function CopyContextSwitchRow({
  id,
  label,
  checked,
  disabled,
  onCheckedChange,
}: {
  id: string;
  label: string;
  checked: boolean;
  disabled?: boolean;
  onCheckedChange: (checked: boolean) => void;
}) {
  return (
    <div className="flex items-center justify-between gap-4">
      <Label
        htmlFor={id}
        className={cn("font-normal", disabled && "text-muted-foreground")}
      >
        {label}
      </Label>
      <Switch
        id={id}
        checked={checked}
        disabled={disabled}
        onCheckedChange={onCheckedChange}
        aria-label={label}
      />
    </div>
  );
}

export function CopyContextSettingsSection() {
  const settingsQuery = useCopyContextSettings();
  const patchMutation = usePatchCopyContextSettings();
  const [prependDraft, setPrependDraft] = useState<string | null>(null);

  const settings =
    settingsQuery.data ?? resolveCopyContextSettings(undefined);
  const prependValue = prependDraft ?? settings.prepend_text;

  function patchField(patch: Partial<CopyContextSettings>) {
    patchMutation.mutate(patch);
  }

  function savePrependText() {
    patchMutation.mutate(
      { prepend_text: prependValue },
      {
        onSuccess: () => {
          setPrependDraft(null);
          toast.success("Prepend text saved");
        },
      },
    );
  }

  if (settingsQuery.isPending) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Copy context</CardTitle>
        </CardHeader>
        <CardContent>
          <Skeleton className="h-40 w-full" />
        </CardContent>
      </Card>
    );
  }

  const copyContextEnabled = settings.visible;

  return (
    <Card>
      <CardHeader>
        <CardTitle>Copy context</CardTitle>
        <CardDescription>
          Controls the ticket modal Copy context action and exported markdown.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="space-y-4">
          <CopyContextSwitchRow
            id="copy-context-visible"
            label="Show Copy context button"
            checked={settings.visible}
            onCheckedChange={(checked) => patchField({ visible: checked })}
          />
          <CopyContextSwitchRow
            id="copy-context-append-contact"
            label="Append contact"
            checked={settings.append_contact}
            disabled={!copyContextEnabled}
            onCheckedChange={(checked) => patchField({ append_contact: checked })}
          />
          {settings.append_contact ? (
            <CopyContextSwitchRow
              id="copy-context-append-contact-fields"
              label="Append contact custom fields"
              checked={settings.append_contact_custom_fields}
              disabled={!copyContextEnabled}
              onCheckedChange={(checked) =>
                patchField({ append_contact_custom_fields: checked })
              }
            />
          ) : null}
          <CopyContextSwitchRow
            id="copy-context-append-custom-fields"
            label="Append ticket custom fields"
            checked={settings.append_custom_fields}
            disabled={!copyContextEnabled}
            onCheckedChange={(checked) =>
              patchField({ append_custom_fields: checked })
            }
          />
        </div>

        <form
          className={cn(
            "space-y-3",
            !copyContextEnabled && "opacity-60",
          )}
          onSubmit={(event) => {
            event.preventDefault();
            void savePrependText();
          }}
        >
          <Label
            htmlFor="copy-context-prepend-text"
            className={cn(!copyContextEnabled && "text-muted-foreground")}
          >
            Prepend text
          </Label>
          <Textarea
            id="copy-context-prepend-text"
            value={prependValue}
            onChange={(event) => setPrependDraft(event.target.value)}
            rows={4}
            placeholder="Optional text copied before the ticket title"
            className="font-mono"
            disabled={!copyContextEnabled}
          />
          <Button
            type="submit"
            size="sm"
            disabled={
              !copyContextEnabled || prependValue === settings.prepend_text
            }
          >
            Save prepend text
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
