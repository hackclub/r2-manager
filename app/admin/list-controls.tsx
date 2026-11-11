"use client";

import { Input } from "@cloudflare/kumo/components/input";

export function ListControls({
  query,
  onQueryChange,
  placeholder,
  filter,
  onFilterChange,
  options,
}: {
  query: string;
  onQueryChange: (value: string) => void;
  placeholder: string;
  filter: string;
  onFilterChange: (value: string) => void;
  options: { value: string; label: string }[];
}) {
  return (
    <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
      <div className="w-full sm:max-w-sm">
        <Input
          type="search"
          aria-label={placeholder}
          placeholder={placeholder}
          value={query}
          onChange={(e) => onQueryChange(e.target.value)}
          className="w-full"
        />
      </div>
      <fieldset
        aria-label="Filter by status"
        className="flex flex-wrap gap-1 rounded-lg border border-kumo-line p-1 text-sm"
      >
        {options.map(({ value, label }) => (
          <button
            key={value}
            type="button"
            aria-pressed={filter === value}
            onClick={() => onFilterChange(value)}
            className={`rounded-md px-3 py-1.5 ${filter === value ? "bg-kumo-tint font-medium text-kumo-strong" : "text-kumo-subtle hover:bg-kumo-tint"}`}
          >
            {label}
          </button>
        ))}
      </fieldset>
    </div>
  );
}

export function Status({
  children,
  active = false,
}: {
  children: React.ReactNode;
  active?: boolean;
}) {
  return (
    <span
      className={`inline-flex shrink-0 items-center gap-1.5 rounded-full border border-kumo-line px-2 py-0.5 text-xs font-medium ${active ? "text-kumo-success" : "text-kumo-subtle"}`}
    >
      <span aria-hidden="true" className="size-1.5 rounded-full bg-current" />
      {children}
    </span>
  );
}

export function EmptyState({ title, description }: { title: string; description: string }) {
  return (
    <div className="p-10 text-center">
      <p className="text-sm font-medium">{title}</p>
      <p className="mt-2 text-sm text-kumo-subtle">{description}</p>
    </div>
  );
}
