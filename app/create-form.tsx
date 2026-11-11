"use client";
import { locations, storageClasses } from "@/lib/format";
import { useActionState, useState } from "react";
import { Select } from "@cloudflare/kumo/components/select";
import { Radio } from "@cloudflare/kumo/components/radio";
import { Button } from "@cloudflare/kumo/components/button";
import { Input } from "@cloudflare/kumo/components/input";
import { createBucketAction } from "./actions";

export function CreateForm() {
  const [message, action, pending] = useActionState(createBucketAction, null);
  const [location, setLocation] = useState("auto");
  return (
    <form action={action} className="space-y-5">
      <Input
        label="Bucket name"
        name="name"
        required
        minLength={3}
        maxLength={63}
        placeholder="my-bucket"
        description="Use lowercase letters, numbers and hyphens. Bucket names are unique across this Cloudflare account."
      />
      <p className="text-sm text-kumo-subtle">Bucket name is permanent.</p>
      <input type="hidden" name="location" value={location === "auto" ? "" : location} />
      <Select
        label="Location hint"
        className="w-full"
        value={location}
        onValueChange={(v) => setLocation(v ?? "auto")}
        items={{ auto: "Automatic", ...locations }}
      />
      <Radio.Group legend="Default storage class" name="storageClass" defaultValue="Standard">
        {Object.entries(storageClasses).map(([value, label]) => (
          <Radio.Item
            key={value}
            value={value}
            label={label}
            description={`Recommended for objects accessed ${value === "Standard" ? "at least" : "less than"} once a month.`}
          />
        ))}
      </Radio.Group>
      {message && <output className="block text-sm text-kumo-default">{message}</output>}
      <Button type="submit" variant="primary" loading={pending}>
        Create bucket
      </Button>
    </form>
  );
}
