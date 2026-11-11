"use client";
import { forwardRef } from "react";
import NextLink from "next/link";
import { LinkProvider, type LinkComponentProps } from "@cloudflare/kumo/utils";

const AppLink = forwardRef<HTMLAnchorElement, LinkComponentProps>(function AppLink(
  { href, to, ...props },
  ref,
) {
  return <NextLink href={href ?? to ?? ""} ref={ref} {...props} />;
});
export const KumoProvider = ({ children }: { children: React.ReactNode }) => (
  <LinkProvider component={AppLink}>{children}</LinkProvider>
);
