"use client";
import type { ReactNode } from "react";
import { Dialog } from "@cloudflare/kumo/components/dialog";
import { Button } from "@cloudflare/kumo/components/button";

/** Runs a server action that returns an error message or null; returns "" on success. */
export const attempt = async (f: () => Promise<string | null>, fallback: string) => {
  try {
    return (await f()) || "";
  } catch {
    return fallback;
  }
};

export function ConfirmDialog({
  open,
  onOpenChange,
  onConfirm,
  title,
  description,
  confirmLabel,
  pending = false,
  error,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onConfirm: () => void;
  title: string;
  description: ReactNode;
  confirmLabel: string;
  pending?: boolean;
  error?: string;
}) {
  return (
    <Dialog.Root role="alertdialog" open={open} onOpenChange={(v) => !pending && onOpenChange(v)}>
      <Dialog size="lg" className="p-6">
        <Dialog.Title className="text-lg font-semibold">{title}</Dialog.Title>
        <Dialog.Description className="mt-3 break-words text-sm text-kumo-subtle">
          {description}
        </Dialog.Description>
        {error && (
          <p className="mt-4 text-sm text-kumo-danger" role="alert">
            {error}
          </p>
        )}
        <div className="mt-6 flex justify-end gap-2">
          <Button
            type="button"
            variant="secondary"
            disabled={pending}
            onClick={() => onOpenChange(false)}
          >
            Cancel
          </Button>
          <Button type="button" variant="destructive" loading={pending} onClick={onConfirm}>
            {confirmLabel}
          </Button>
        </div>
      </Dialog>
    </Dialog.Root>
  );
}
