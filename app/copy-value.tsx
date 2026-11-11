"use client";
import { ClipboardText } from "@cloudflare/kumo/components/clipboard-text";

export const CopyValue = ({
  value,
  label,
  alwaysVisible = false,
}: {
  value: string;
  label: string;
  alwaysVisible?: boolean;
}) => (
  <ClipboardText
    text={value}
    size="sm"
    labels={{ copyAction: `Copy ${label}` }}
    tooltip={{ text: `Copy ${label}`, copiedText: "Copied", side: "bottom" }}
    className={`${alwaysVisible ? "[&>button]:opacity-100!" : ""} group h-auto min-w-0 justify-start border-0 bg-transparent p-0 font-sans text-sm shadow-none ring-0 [&>span:first-child]:grow-0 [&>span:first-child]:ps-0 [&>button]:border-0! [&>button]:opacity-0 hover:[&>button]:opacity-100 focus-within:[&>button]:opacity-100 [@media(hover:none)]:[&>button]:opacity-100`}
  />
);
