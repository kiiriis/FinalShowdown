"use client";

import * as React from "react";
import { RotateCcw, Save, UserPlus, Handshake, Copy } from "lucide-react";
import { toast } from "sonner";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "./ui/card";
import { Button } from "./ui/button";
import { Textarea } from "./ui/textarea";
import { cn } from "@/lib/utils";
import {
  DEFAULT_CONNECTION_TEMPLATE,
  DEFAULT_REFERRAL_TEMPLATE,
  TEMPLATE_PLACEHOLDERS,
  renderTemplate,
} from "@/lib/templates";

export function TemplatesForm({
  initialConnection,
  initialReferral,
  previewCompany,
  previewRole,
  previewLink,
  userName,
  userEmail,
}: {
  initialConnection: string | null;
  initialReferral: string | null;
  previewCompany: string;
  previewRole: string;
  previewLink: string;
  userName: string;
  userEmail: string;
}) {
  const [connection, setConnection] = React.useState(
    initialConnection ?? DEFAULT_CONNECTION_TEMPLATE,
  );
  const [referral, setReferral] = React.useState(
    initialReferral ?? DEFAULT_REFERRAL_TEMPLATE,
  );
  const [saving, setSaving] = React.useState(false);

  const vars = {
    companyName: previewCompany,
    jobRole: previewRole,
    jobLink: previewLink,
    userName,
    userEmail,
  };

  const connectionDirty =
    connection !== (initialConnection ?? DEFAULT_CONNECTION_TEMPLATE);
  const referralDirty =
    referral !== (initialReferral ?? DEFAULT_REFERRAL_TEMPLATE);
  const dirty = connectionDirty || referralDirty;

  async function save() {
    setSaving(true);
    try {
      // Send null when the textarea exactly matches the default, so the DB
      // stays clean and users keep tracking future default changes.
      const body = {
        connectionTemplate:
          connection === DEFAULT_CONNECTION_TEMPLATE ? null : connection,
        referralTemplate:
          referral === DEFAULT_REFERRAL_TEMPLATE ? null : referral,
      };
      const res = await fetch("/api/user/templates", {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(body),
      });
      if (!res.ok) throw new Error(await res.text());
      toast.success("Templates saved");
    } catch {
      toast.error("Couldn't save templates");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="text-sm">Placeholders</CardTitle>
          <CardDescription>
            Click any token to copy it. These get replaced automatically when
            you open the dialog from a job row.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap gap-2">
            {TEMPLATE_PLACEHOLDERS.map((p) => (
              <button
                key={p.token}
                type="button"
                onClick={() => {
                  navigator.clipboard.writeText(p.token).then(
                    () => toast.success(`Copied ${p.token}`, { duration: 1200 }),
                    () => toast.error("Clipboard blocked"),
                  );
                }}
                className="group inline-flex items-center gap-1.5 rounded-md border bg-muted/30 px-2 py-1 text-xs font-mono hover:bg-muted transition-colors"
                title={p.description}
              >
                {p.token}
                <Copy className="h-3 w-3 opacity-0 group-hover:opacity-100 transition-opacity" />
              </button>
            ))}
          </div>
        </CardContent>
      </Card>

      <TemplateEditor
        icon={<UserPlus className="h-4 w-4" />}
        title="Connection request"
        description="Sent before the person has accepted your LinkedIn request."
        value={connection}
        onChange={setConnection}
        defaultValue={DEFAULT_CONNECTION_TEMPLATE}
        vars={vars}
      />

      <TemplateEditor
        icon={<Handshake className="h-4 w-4" />}
        title="Referral ask"
        description="Sent once the person has accepted the connection."
        value={referral}
        onChange={setReferral}
        defaultValue={DEFAULT_REFERRAL_TEMPLATE}
        vars={vars}
      />

      <div className="flex items-center justify-end gap-2 sticky bottom-0 bg-background/80 backdrop-blur-sm py-3 -mx-4 px-4 border-t">
        <span
          className={cn(
            "text-xs mr-auto",
            dirty ? "text-amber-600 dark:text-amber-400" : "text-muted-foreground",
          )}
        >
          {dirty ? "Unsaved changes" : "All changes saved"}
        </span>
        <Button onClick={save} disabled={saving || !dirty} size="sm">
          <Save className="h-3.5 w-3.5 mr-1" />
          {saving ? "Saving…" : "Save"}
        </Button>
      </div>
    </div>
  );
}

function TemplateEditor({
  icon,
  title,
  description,
  value,
  onChange,
  defaultValue,
  vars,
}: {
  icon: React.ReactNode;
  title: string;
  description: string;
  value: string;
  onChange: (v: string) => void;
  defaultValue: string;
  vars: Record<string, string>;
}) {
  const preview = renderTemplate(value, vars);
  const isDefault = value === defaultValue;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          {icon} {title}
        </CardTitle>
        <CardDescription>{description}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="space-y-1.5">
          <div className="flex items-center justify-between">
            <label className="text-xs font-medium text-muted-foreground">
              Template
            </label>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => onChange(defaultValue)}
              disabled={isDefault}
              className="h-7 text-muted-foreground"
            >
              <RotateCcw className="h-3 w-3 mr-1" />
              Reset to default
            </Button>
          </div>
          <Textarea
            value={value}
            onChange={(e) => onChange(e.target.value.slice(0, 4000))}
            className="min-h-[180px] resize-y font-mono text-[13px] leading-relaxed"
          />
        </div>
        <div className="space-y-1.5">
          <label className="text-xs font-medium text-muted-foreground">
            Preview (with placeholders filled in)
          </label>
          <div className="rounded-lg border bg-muted/30 p-3 text-[13px] whitespace-pre-wrap break-words font-mono leading-relaxed">
            {preview}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
