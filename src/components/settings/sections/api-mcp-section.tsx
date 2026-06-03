"use client";

import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { ApiKeyForm, RevokeButton } from "@/components/settings/api-key-form";
import { McpSettingsSection } from "@/components/mcp/mcp-panel";

type ApiKey = {
  id: string;
  name: string;
  key_prefix: string;
  created_at: string;
};

type ApiMcpSettingsSectionProps = {
  apiKeys: ApiKey[];
  newKey: string | null;
  onNewKey: (key: string) => void;
  onReload: () => void;
  onCopyNewKey: () => void;
  onError: (message: string | null) => void;
};

export function ApiMcpSettingsSection({
  apiKeys,
  newKey,
  onNewKey,
  onReload,
  onCopyNewKey,
  onError,
}: ApiMcpSettingsSectionProps) {
  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>API keys</CardTitle>
          <CardDescription>
            Programmatic access to the Ticqex API.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <ApiKeyForm
            onCreated={(key) => {
              onNewKey(key);
              onReload();
            }}
          />
          {newKey && (
            <Alert>
              <AlertDescription className="space-y-2">
                <span className="block">
                  Copy your new key now — it won&apos;t be shown again:
                </span>
                <div className="flex flex-col gap-2 sm:flex-row sm:items-start">
                  <code className="min-w-0 flex-1 break-all rounded bg-muted px-2 py-1 font-mono text-xs">
                    {newKey}
                  </code>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="shrink-0"
                    onClick={() => {
                      void onCopyNewKey();
                    }}
                  >
                    Copy key
                  </Button>
                </div>
              </AlertDescription>
            </Alert>
          )}
          {apiKeys.length > 0 ? (
            <>
              <Separator />
              <ul className="space-y-2 text-sm">
                {apiKeys.map((k) => (
                  <li key={k.id} className="flex items-center justify-between">
                    <span>
                      {k.name} ({k.key_prefix}…)
                    </span>
                    <RevokeButton
                      id={k.id}
                      name={k.name}
                      keyPrefix={k.key_prefix}
                      onRevoked={onReload}
                      onError={onError}
                    />
                  </li>
                ))}
              </ul>
            </>
          ) : null}
        </CardContent>
      </Card>

      <div className="space-y-4">
        <div>
          <h2 className="font-heading text-lg font-semibold">MCP</h2>
          <p className="text-sm text-muted-foreground">
            Connect Ticqex to any MCP-compatible client through the native
            Streamable HTTP endpoint.
          </p>
        </div>
        <McpSettingsSection />
      </div>
    </div>
  );
}
