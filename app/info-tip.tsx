"use client";
import type { ReactNode } from "react";
import { Tooltip } from "@cloudflare/kumo/components/tooltip";
import { Button } from "@cloudflare/kumo/components/button";
import { InfoIcon } from "@phosphor-icons/react";

export const InfoTip = ({ label, children }: { label: string; children: ReactNode }) => (
  <Tooltip
    content={children}
    render={
      <Button
        variant="ghost"
        size="sm"
        className="h-4 w-4 min-w-0 p-0 text-kumo-subtle"
        aria-label={`About ${label}`}
        icon={<InfoIcon size={14} weight="fill" />}
      />
    }
  />
);
