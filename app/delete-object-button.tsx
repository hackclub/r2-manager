"use client";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@cloudflare/kumo/components/button";
import { ConfirmDialog, attempt } from "./confirm-dialog";
import { deleteObject } from "./object-actions";

/** Confirm-then-delete flow for objects in `bucket`; `done` runs after a successful delete. */
export function useDeleteObject(bucket: string, done: () => void) {
  const [key, setKey] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [pending, start] = useTransition();
  const dialog = (
    <ConfirmDialog
      open={key !== null}
      onOpenChange={(o) => !o && setKey(null)}
      onConfirm={() =>
        key &&
        start(async () => {
          const e = await attempt(() => deleteObject(bucket, key), "Could not delete the object.");
          setError(e);
          if (!e) {
            setKey(null);
            done();
          }
        })
      }
      title="Delete object?"
      description={
        <>
          Permanently delete <strong>{key}</strong>? This cannot be undone.
        </>
      }
      confirmLabel="Delete object"
      pending={pending}
      error={error}
    />
  );
  return {
    open: (k: string) => {
      setError("");
      setKey(k);
    },
    pending,
    dialog,
  };
}

export function DeleteObjectButton({
  bucket,
  objectKey,
  returnTo,
}: {
  bucket: string;
  objectKey: string;
  returnTo?: string;
}) {
  const router = useRouter();
  const d = useDeleteObject(bucket, () => (returnTo ? router.push(returnTo) : router.refresh()));
  return (
    <div>
      <Button
        type="button"
        variant="ghost"
        size="sm"
        loading={d.pending}
        onClick={() => d.open(objectKey)}
        aria-label={`Delete ${objectKey}`}
      >
        Delete
      </Button>
      {d.dialog}
    </div>
  );
}
