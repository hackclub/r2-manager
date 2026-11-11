"use client";
import { storageClasses } from "@/lib/format";
import dynamic from "next/dynamic";
import { CheckIcon } from "@phosphor-icons/react";
import { useActionState, useState } from "react";
import { Button } from "@cloudflare/kumo/components/button";
import { Select } from "@cloudflare/kumo/components/select";
import { Checkbox } from "@cloudflare/kumo/components/checkbox";
import { InputArea } from "@cloudflare/kumo/components/input";
import { saveSetting } from "./settings-actions";

const CorsEditor = dynamic(() => import("./cors-editor"), {
  ssr: false,
  loading: () => (
    <div
      className="h-[466px] rounded-lg border border-kumo-line bg-kumo-base"
      aria-label="Loading CORS editor"
      aria-busy="true"
    />
  ),
});
type Props = {
  bucket: string;
  setting: "storage" | "public" | "cors" | "lifecycle" | "lock";
  value: string;
};

// Keyed so local state resets when the bucket or setting changes.
export const SettingForm = (p: Props) => <Form key={`${p.bucket}:${p.setting}`} {...p} />;

function Form({ bucket, setting, value }: Props) {
  const [message, action, pending] = useActionState(saveSetting, null);
  const [selected, setSelected] = useState(value);
  const [confirmed, setConfirmed] = useState(false);
  const [valid, setValid] = useState(false);
  const saved = message === "Saved.";
  const confirm = (label: string) => (
    <Checkbox checked={confirmed} onCheckedChange={setConfirmed} label={label} />
  );
  const hidden = <input type="hidden" name="value" value={selected} />;
  return (
    <form action={action} className="mt-4 space-y-3">
      <input type="hidden" name="bucket" value={bucket} />
      {confirmed && <input type="hidden" name="confirm" value="yes" />}
      <input type="hidden" name="setting" value={setting} />
      {setting === "storage" || setting === "public" ? (
        <>
          {hidden}
          <Select
            aria-label={setting === "storage" ? "Default storage class" : "Public development URL"}
            value={selected}
            onValueChange={(v) => setSelected(v ?? value)}
            items={setting === "storage" ? storageClasses : { false: "Disabled", true: "Enabled" }}
          />
          {setting === "public" &&
            confirm("I understand enabling this makes objects publicly accessible.")}
        </>
      ) : setting === "cors" ? (
        <>
          {hidden}
          <CorsEditor
            bucket={bucket}
            value={selected}
            onChange={setSelected}
            onValidityChange={setValid}
          />
        </>
      ) : (
        <>
          <InputArea
            name="value"
            aria-label={`${setting} rules JSON`}
            defaultValue={value}
            rows={8}
            spellCheck={false}
            className="w-full font-mono text-xs"
          />
          {confirm("I understand these rules can affect existing objects.")}
        </>
      )}
      <div className="flex items-center gap-3">
        <Button
          type="submit"
          variant="secondary"
          loading={pending}
          disabled={setting === "cors" && !valid}
        >
          Save
        </Button>
        {message && (
          <output
            className={`inline-flex items-center gap-1.5 text-sm ${saved ? "text-kumo-success" : "text-kumo-default"}`}
          >
            {saved && <CheckIcon size={16} aria-hidden="true" />}
            {message}
          </output>
        )}
      </div>
    </form>
  );
}
