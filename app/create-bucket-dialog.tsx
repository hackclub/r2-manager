"use client";
import { useSearchParams } from "next/navigation";
import { Dialog } from "@cloudflare/kumo/components/dialog";
import { Button } from "@cloudflare/kumo/components/button";
import { PlusIcon, XIcon } from "@phosphor-icons/react";
import { CreateForm } from "./create-form";

export function CreateBucketDialog() {
  const params = useSearchParams();
  return (
    <Dialog.Root
      defaultOpen={params.get("create") === "1"}
      onOpenChange={(open) => {
        if (!open && params.has("create")) {
          const url = new URL(window.location.href);
          url.searchParams.delete("create");
          window.history.replaceState(null, "", url.pathname + url.search);
        }
      }}
    >
      <Dialog.Trigger render={<Button variant="primary" icon={<PlusIcon />} />}>
        Create bucket
      </Dialog.Trigger>
      <Dialog size="lg" className="max-h-[90dvh] overflow-y-auto p-6">
        <div className="mb-2 flex items-center justify-between gap-4">
          <Dialog.Title className="text-xl font-semibold">Create a bucket</Dialog.Title>
          <Dialog.Close render={<Button variant="ghost" aria-label="Close" icon={<XIcon />} />} />
        </div>
        <Dialog.Description className="mb-6 text-sm text-kumo-subtle">
          A bucket stores your objects in R2. Buckets are private by default.
        </Dialog.Description>
        <CreateForm />
      </Dialog>
    </Dialog.Root>
  );
}
