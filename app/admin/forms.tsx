"use client";
import { useActionState, useState } from "react";
import { Input } from "@cloudflare/kumo/components/input";
import { Button } from "@cloudflare/kumo/components/button";
import { Select } from "@cloudflare/kumo/components/select";
import { allowUser, assignBucket } from "./actions";

export function AccessForm({ subject, allowed }: { subject?: string; allowed?: boolean }) {
  const [message, action, pending] = useActionState(allowUser, null);
  return (
    <form action={action} className="flex flex-wrap items-center gap-3">
      {subject ? (
        <input type="hidden" name="subject" value={subject} />
      ) : (
        <Input
          name="subject"
          aria-label="Hack Club Auth ID"
          placeholder="Hack Club Auth ID"
          required
        />
      )}
      <input type="hidden" name="allowed" value={allowed ? "false" : "true"} />
      <Button type="submit" variant="secondary" loading={pending}>
        {allowed ? "Revoke access" : "Allow access"}
      </Button>
      {message && <output className="text-sm text-kumo-subtle">{message}</output>}
    </form>
  );
}
export function AssignmentForm({
  bucket,
  users,
}: {
  bucket: string;
  users: { id: string; name: string; email: string }[];
}) {
  const [owner, setOwner] = useState<string | null>(null);
  const [message, action, pending] = useActionState(assignBucket, null);
  return (
    <form action={action} className="flex flex-wrap items-center gap-3">
      <input type="hidden" name="bucket" value={bucket} />
      <input type="hidden" name="owner" value={owner ?? ""} />
      <Select
        aria-label={`Owner for ${bucket}`}
        placeholder="Choose an owner"
        value={owner}
        onValueChange={setOwner}
        items={Object.fromEntries(users.map((u) => [u.id, `${u.name} (${u.email})`]))}
      />
      <Button type="submit" variant="secondary" disabled={!owner} loading={pending}>
        Assign bucket
      </Button>
      {message && <output className="text-sm text-kumo-subtle">{message}</output>}
    </form>
  );
}
