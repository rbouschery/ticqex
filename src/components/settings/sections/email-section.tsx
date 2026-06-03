"use client";

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { EmailSignatureForm } from "@/components/settings/email-signature-form";
import { EmailSnippetsSection } from "@/components/settings/email-snippets-section";
import { EmailThreadOrderSetting } from "@/components/settings/email-thread-order-setting";
import { InboundEmailStatusSetting } from "@/components/settings/inbound-email-status-setting";

type EmailSettingsSectionProps = {
  emailSignature: string;
  onSignatureSaved: () => void;
};

export function EmailSettingsSection({
  emailSignature,
  onSignatureSaved,
}: EmailSettingsSectionProps) {
  return (
    <div className="space-y-6">
      <EmailThreadOrderSetting />

      <Card>
        <CardHeader>
          <CardTitle>New inbound emails</CardTitle>
          <CardDescription>
            Status assigned when an email creates a new ticket. Defaults to the
            first board column in order.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <InboundEmailStatusSetting />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Email signature</CardTitle>
          <CardDescription>
            Appended to outbound email replies sent from the ticket view.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <EmailSignatureForm
            key={emailSignature}
            signature={emailSignature}
            onSaved={onSignatureSaved}
          />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Email snippets</CardTitle>
          <CardDescription>
            Canned responses available in the ticket email compose snippet
            picker.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <EmailSnippetsSection />
        </CardContent>
      </Card>
    </div>
  );
}
