"use client";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@cloudflare/kumo/components/button";
import { PlusIcon } from "@phosphor-icons/react";
import { Input } from "@cloudflare/kumo/components/input";
import { attempt } from "./confirm-dialog";
import { createFolder } from "./object-actions";

export function FolderForm({ bucket, prefix }: { bucket: string; prefix: string }) {
  const [open, setOpen] = useState(false),
    [name, setName] = useState(""),
    [error, setError] = useState(""),
    [pending, start] = useTransition();
  const router = useRouter();
  return (
    <div>
      <Button type="button" variant="primary" icon={<PlusIcon />} onClick={() => setOpen(!open)}>
        Add folder
      </Button>
      {open && (
        <form
          onSubmit={(e) => {
            e.preventDefault();
            setError("");
            start(async () => {
              const err = await attempt(
                () => createFolder(bucket, prefix, name),
                "Could not create folder.",
              );
              setError(err);
              if (err) return;
              setName("");
              setOpen(false);
              router.refresh();
            });
          }}
          className="mt-3 flex flex-wrap gap-2"
        >
          <Input
            value={name}
            onChange={(e) => setName(e.target.value)}
            required
            aria-label="Folder name"
            placeholder="Folder name"
          />
          <Button type="submit" variant="primary" loading={pending}>
            Create
          </Button>
          {error && <output className="text-sm">{error}</output>}
        </form>
      )}
    </div>
  );
}
