"use client";
import { useActionState } from "react";
import { Button } from "@cloudflare/kumo/components/button";
import { Input } from "@cloudflare/kumo/components/input";
import { deleteBucket } from "./object-actions";

export function DeleteBucketForm({ name }: { name: string }) {
  const [message, action, pending] = useActionState(deleteBucket, null);
  return (
    <form action={action} className="mt-5 space-y-4">
      <input type="hidden" name="bucket" value={name} />
      <Input
        name="confirmation"
        label="Type the bucket name to confirm"
        required
        autoComplete="off"
      />
      {message && <output className="block text-sm">{message}</output>}
      <Button variant="destructive" type="submit" loading={pending}>
        Delete bucket
      </Button>
    </form>
  );
}
