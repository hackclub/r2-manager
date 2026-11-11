"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { DatabaseIcon, UsersIcon } from "@phosphor-icons/react";

export function AdminNavigation() {
  const path = usePathname();
  return (
    <nav aria-label="Administration" className="mt-6 mb-7 flex gap-5 border-b border-kumo-line">
      {[
        { href: "/admin/users", label: "Users", icon: UsersIcon },
        { href: "/admin/buckets", label: "Buckets", icon: DatabaseIcon },
      ].map(({ href, label, icon: Icon }) => (
        <Link
          key={href}
          href={href}
          aria-current={path === href ? "page" : undefined}
          className={`flex items-center gap-2 border-b-2 px-1 pb-3 text-sm font-medium ${path === href ? "border-kumo-brand text-kumo-strong" : "border-transparent text-kumo-subtle hover:text-kumo-default"}`}
        >
          <Icon size={18} />
          {label}
        </Link>
      ))}
    </nav>
  );
}
