"use client";

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { StatusColumnsSection } from "@/components/settings/status-columns-section";
import { TagsSection } from "@/components/settings/tags-section";

export function BoardSettingsSection() {
  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Board columns</CardTitle>
          <CardDescription>
            Drag to reorder lanes, pick colors, rename statuses, and choose board
            visibility.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <StatusColumnsSection />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Tags</CardTitle>
          <CardDescription>
            Organization-wide labels with colors shown on board cards and ticket
            views.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <TagsSection />
        </CardContent>
      </Card>
    </div>
  );
}
