"use client";
import { useState, useTransition } from "react";
import { Button } from "@cloudflare/kumo/components/button";
import { Checkbox } from "@cloudflare/kumo/components/checkbox";
import { CheckIcon } from "@phosphor-icons/react";
import { authClient } from "@/lib/auth-client";
import { scopes as catalog, type Scope } from "@/lib/mcp/scopes";

const optional = new Set<Scope>(["r2:write", "offline_access"]);

export function ConsentForm({ scopes, denyOnly = false }: { scopes: Scope[]; denyOnly?: boolean }) {
  const [declined, setDeclined] = useState(new Set<Scope>());
  const [pending, start] = useTransition();
  const [error, setError] = useState("");
  const respond = (accept: boolean) =>
    start(async () => {
      setError("");
      const { data, error } = await authClient.oauth2.consent({
        accept,
        ...(accept && { scope: scopes.filter((s) => !declined.has(s)).join(" ") }),
      });
      const url = (data as { url?: string } | null)?.url;
      if (url) return window.location.assign(url);
      setError(error?.message || "The request expired. Start connecting again from the app.");
    });
  return (
    <>
      {scopes.length > 0 && (
        <ul className="divide-y divide-kumo-line rounded-lg border border-kumo-line">
          {scopes.map((scope) => (
            <li key={scope} className="flex gap-3 p-3 text-sm">
              {optional.has(scope) ? (
                <Checkbox
                  aria-label={catalog[scope].title}
                  checked={!declined.has(scope)}
                  onCheckedChange={(on) =>
                    setDeclined((old) => {
                      const next = new Set(old);
                      if (on) next.delete(scope);
                      else next.add(scope);
                      return next;
                    })
                  }
                />
              ) : (
                <CheckIcon className="mt-0.5 shrink-0 text-kumo-success" aria-hidden="true" />
              )}
              <span>
                <span className="block font-medium">{catalog[scope].title}</span>
                <span className="mt-0.5 block text-kumo-subtle">{catalog[scope].detail}</span>
              </span>
            </li>
          ))}
        </ul>
      )}
      {error && (
        <p className="mt-4 text-sm text-kumo-danger" role="alert">
          {error}
        </p>
      )}
      <div className="mt-6 flex justify-end gap-2">
        <Button variant="secondary" disabled={pending} onClick={() => respond(false)}>
          {denyOnly ? "Go back" : "Deny"}
        </Button>
        {!denyOnly && (
          <Button variant="primary" loading={pending} onClick={() => respond(true)}>
            Allow access
          </Button>
        )}
      </div>
    </>
  );
}
