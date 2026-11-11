"use client";
import { useActionState, useState } from "react";
import { Button } from "@cloudflare/kumo/components/button";
import { Input } from "@cloudflare/kumo/components/input";
import { Checkbox } from "@cloudflare/kumo/components/checkbox";
import { addCustomDomain } from "./settings-actions";
export function DomainForm({ bucket }: { bucket: string }) {
  const [message, action, pending] = useActionState(addCustomDomain, null);
  const [confirmed, setConfirmed] = useState(false);
  return (
    <form action={action} className="mt-4 space-y-3">
      <input type="hidden" name="bucket" value={bucket} />
      {confirmed && <input type="hidden" name="confirm" value="yes" />}
      <div className="flex flex-wrap items-center gap-2 text-sm">
        <Input
          name="subdomain"
          aria-label="Subdomain"
          placeholder={bucket}
          required
          maxLength={63}
          pattern="[a-z0-9](?:[a-z0-9-]*[a-z0-9])?"
        />
        <span>.hackclub-assets.com</span>
      </div>
      <Checkbox
        checked={confirmed}
        onCheckedChange={setConfirmed}
        label="I understand this domain will make the bucket public."
      />
      <div className="flex items-center gap-3">
        <Button type="submit" loading={pending}>
          Connect domain
        </Button>
        {message && <output className="text-sm">{message}</output>}
      </div>
    </form>
  );
}
