"use client";
import { useState } from "react";
import dynamic from "next/dynamic";
import { Button } from "@cloudflare/kumo/components/button";
import { Checkbox } from "@cloudflare/kumo/components/checkbox";
import { Input, InputArea } from "@cloudflare/kumo/components/input";
import { Select } from "@cloudflare/kumo/components/select";
import {
  corsMethods,
  ruleError,
  type CorsRule,
  type LifecycleRule,
  type LifecycleCondition,
  type RuleKind,
} from "@/lib/rule-policy";

const CorsJsonEditor = dynamic(() => import("./cors-editor"), {
  ssr: false,
  loading: () => <p className="text-sm text-kumo-subtle">Loading JSON editor…</p>,
});
const days = 86400;
const split = (text: string) => [
  ...new Set(
    text
      .split(/[\n,]/)
      .map((s) => s.trim())
      .filter(Boolean),
  ),
];

// Keep whitespace while typing; synchronize only when a preset or JSON edit changes the list.
function StringList({
  label,
  value,
  onChange,
  placeholder,
}: {
  label: string;
  value: string[];
  onChange: (value: string[]) => void;
  placeholder?: string;
}) {
  const canonical = value.join("\n");
  const [seen, setSeen] = useState(canonical);
  const [text, setText] = useState(canonical);
  if (canonical !== seen) {
    setSeen(canonical);
    setText(canonical);
  }
  return (
    <InputArea
      label={label}
      value={text}
      rows={2}
      placeholder={placeholder}
      description="One per line, or separated by commas."
      onChange={(e) => {
        const list = split(e.target.value);
        setText(e.target.value);
        setSeen(list.join("\n"));
        onChange(list);
      }}
    />
  );
}
function Condition({
  label,
  value,
  onChange,
  ageOnly = false,
}: {
  label: string;
  value: LifecycleCondition;
  onChange: (v: LifecycleCondition) => void;
  ageOnly?: boolean;
}) {
  const [unit, setUnit] = useState<"days" | "seconds">(
    value.type === "Age" && value.maxAge % days !== 0 ? "seconds" : "days",
  );
  const multiplier = unit === "days" ? days : 1;
  return (
    <div className="grid gap-3 sm:grid-cols-2">
      {!ageOnly && (
        <Select
          label={`${label}: timing`}
          value={value.type}
          items={{ Age: "After an age", Date: "On a date (UTC)" }}
          onValueChange={(v) => {
            const { maxAge: _age, date: _date, ...rest } = value;
            onChange(
              v === "Date"
                ? {
                    ...rest,
                    type: "Date",
                    date: new Date(Date.now() + 30 * days * 1000).toISOString(),
                  }
                : { ...rest, type: "Age", maxAge: 30 * days },
            );
          }}
        />
      )}
      {value.type === "Age" ? (
        <div className="grid grid-cols-[minmax(0,1fr)_auto] items-end gap-2">
          <Input
            label={`${label}: age in ${unit}`}
            type="number"
            min={0}
            step="any"
            value={value.maxAge == null ? "" : String(value.maxAge / multiplier)}
            onChange={(e) =>
              onChange({
                ...value,
                maxAge: e.target.value === "" ? NaN : Number(e.target.value) * multiplier,
              })
            }
          />
          <Select
            aria-label={`${label}: age unit`}
            value={unit}
            items={{ days: "Days", seconds: "Seconds" }}
            onValueChange={(v) => setUnit(v === "seconds" ? "seconds" : "days")}
          />
        </div>
      ) : (
        <Input
          label={`${label}: date and time (UTC)`}
          type="datetime-local"
          step={1}
          value={
            Number.isFinite(Date.parse(value.date))
              ? new Date(value.date).toISOString().slice(0, 19)
              : ""
          }
          onChange={(e) => onChange({ ...value, date: e.target.value ? `${e.target.value}Z` : "" })}
        />
      )}
    </div>
  );
}

export function RuleEditor({
  bucket,
  kind,
  value,
  onChange,
}: {
  bucket: string;
  kind: RuleKind;
  value: string;
  onChange: (v: string) => void;
}) {
  let parsed: unknown;
  try {
    parsed = JSON.parse(value);
  } catch {
    parsed = null;
  }
  const error = ruleError(kind, parsed);
  const [mode, setMode] = useState<"visual" | "json">(() => (error ? "json" : "visual"));
  const [revision, setRevision] = useState(0);
  // Visual drafts may be incomplete. Do not switch modes or discard those drafts on validation errors.
  const rules = Array.isArray(parsed) ? parsed : [];
  const write = (next: unknown[]) => onChange(JSON.stringify(next, null, 2));
  const update = (i: number, next: unknown) => write(rules.map((r, n) => (n === i ? next : r)));
  const remove = (i: number) => {
    setRevision(revision + 1);
    write(rules.filter((_, n) => i !== n));
  };
  const add = (rule: unknown) => write([...rules, rule]);
  const newLifecycle = (action: "abort" | "expire") => ({
    id: `rule-${crypto.randomUUID().slice(0, 8)}`,
    enabled: true,
    conditions: { prefix: "" },
    ...(action === "abort"
      ? { abortMultipartUploadsTransition: { condition: { type: "Age", maxAge: 7 * days } } }
      : { deleteObjectsTransition: { condition: { type: "Age", maxAge: 30 * days } } }),
  });
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <fieldset
          className="flex gap-2"
          aria-label={`${kind === "cors" ? "CORS" : "Lifecycle"} editor mode`}
        >
          <Button
            type="button"
            size="sm"
            variant={mode === "visual" ? "secondary" : "ghost"}
            aria-pressed={mode === "visual"}
            disabled={mode === "json" && !!error}
            onClick={() => {
              setRevision(revision + 1);
              setMode("visual");
            }}
          >
            Visual editor
          </Button>
          <Button
            type="button"
            size="sm"
            variant={mode === "json" ? "secondary" : "ghost"}
            aria-pressed={mode === "json"}
            onClick={() => setMode("json")}
          >
            Advanced JSON
          </Button>
        </fieldset>
        <span className="text-xs text-kumo-subtle">{rules.length} / 100 rules</span>
      </div>
      {mode === "json" ? (
        kind === "cors" ? (
          <CorsJsonEditor
            bucket={bucket}
            value={value}
            onChange={onChange}
            onValidityChange={() => {}}
          />
        ) : (
          <InputArea
            label="Lifecycle rules JSON"
            value={value}
            rows={14}
            spellCheck={false}
            className="w-full font-mono text-xs"
            onChange={(e) => onChange(e.target.value)}
          />
        )
      ) : (
        <>
          <div className="flex flex-wrap gap-2">
            {kind === "cors" ? (
              <>
                <Button
                  type="button"
                  size="sm"
                  variant="secondary"
                  disabled={rules.length >= 100}
                  onClick={() => add({ allowed: { origins: ["*"], methods: ["GET", "HEAD"] } })}
                >
                  Add public read rule
                </Button>
                <Button
                  type="button"
                  size="sm"
                  variant="secondary"
                  disabled={rules.length >= 100}
                  onClick={() =>
                    add({
                      allowed: {
                        origins: [window.location.origin],
                        methods: ["PUT"],
                        headers: ["content-type"],
                      },
                    })
                  }
                >
                  Allow uploads from this app
                </Button>
                <Button
                  type="button"
                  size="sm"
                  variant="ghost"
                  disabled={rules.length >= 100}
                  onClick={() => add({ allowed: { origins: [], methods: ["GET"] } })}
                >
                  Add custom rule
                </Button>
              </>
            ) : (
              <>
                <Button
                  type="button"
                  size="sm"
                  variant="secondary"
                  disabled={rules.length >= 100}
                  onClick={() => add(newLifecycle("abort"))}
                >
                  Clean up incomplete uploads
                </Button>
                <Button
                  type="button"
                  size="sm"
                  variant="secondary"
                  disabled={rules.length >= 100}
                  onClick={() => add(newLifecycle("expire"))}
                >
                  Add expiration rule
                </Button>
              </>
            )}
          </div>
          {!rules.length && (
            <p className="rounded-lg border border-dashed border-kumo-line p-5 text-sm text-kumo-subtle">
              No rules. Add a rule above to get started. Saving an empty list removes all{" "}
              {kind === "cors" ? "CORS" : "lifecycle"} rules.
            </p>
          )}
          {rules.map((raw, i) => (
            <fieldset
              key={`${revision}:${i}`}
              className="space-y-4 rounded-lg border border-kumo-line p-4 sm:p-5"
            >
              <legend className="px-1 text-sm font-medium">Rule {i + 1}</legend>
              {kind === "cors" ? (
                <CorsFields rule={raw as CorsRule} onChange={(r) => update(i, r)} />
              ) : (
                <LifecycleFields rule={raw as LifecycleRule} onChange={(r) => update(i, r)} />
              )}
              <Button type="button" size="sm" variant="ghost" onClick={() => remove(i)}>
                Remove rule {i + 1}
              </Button>
            </fieldset>
          ))}
        </>
      )}
      {error && (
        <p role="alert" className="text-sm text-kumo-danger">
          {error}
        </p>
      )}
      <p className="text-xs text-kumo-subtle">
        Saving replaces all {kind === "cors" ? "CORS" : "lifecycle"} rules for this bucket.
      </p>
    </div>
  );
}
function CorsFields({ rule, onChange }: { rule: CorsRule; onChange: (r: CorsRule) => void }) {
  return (
    <>
      <Input
        label="Rule name (optional)"
        value={rule.id ?? ""}
        onChange={(e) => {
          const next = { ...rule };
          if (e.target.value) next.id = e.target.value;
          else delete next.id;
          onChange(next);
        }}
      />
      <StringList
        label="Allowed origins"
        value={rule.allowed.origins}
        placeholder="https://example.com"
        onChange={(origins) => onChange({ ...rule, allowed: { ...rule.allowed, origins } })}
      />
      <fieldset>
        <legend className="mb-2 text-sm font-medium">Allowed methods</legend>
        <div className="flex flex-wrap gap-4">
          {corsMethods.map((m) => (
            <Checkbox
              key={m}
              label={m}
              checked={rule.allowed.methods.includes(m)}
              onCheckedChange={(checked) =>
                onChange({
                  ...rule,
                  allowed: {
                    ...rule.allowed,
                    methods: checked
                      ? [...rule.allowed.methods, m]
                      : rule.allowed.methods.filter((v) => v !== m),
                  },
                })
              }
            />
          ))}
        </div>
      </fieldset>
      <div className="grid gap-4 sm:grid-cols-2">
        <StringList
          label="Allowed request headers"
          value={rule.allowed.headers ?? []}
          placeholder="content-type"
          onChange={(headers) => onChange({ ...rule, allowed: { ...rule.allowed, headers } })}
        />
        <StringList
          label="Exposed response headers"
          value={rule.exposeHeaders ?? []}
          placeholder="ETag"
          onChange={(exposeHeaders) => onChange({ ...rule, exposeHeaders })}
        />
      </div>
      <Input
        label="Preflight cache duration (seconds)"
        type="number"
        min={0}
        max={86400}
        step={1}
        value={rule.maxAgeSeconds === undefined ? "" : String(rule.maxAgeSeconds)}
        placeholder="Browser default"
        onChange={(e) => {
          const next = { ...rule };
          if (e.target.value === "") delete next.maxAgeSeconds;
          else next.maxAgeSeconds = Number(e.target.value);
          onChange(next);
        }}
      />
      <p className="text-xs text-kumo-subtle">
        Use * to allow any origin or request header. CORS controls browser requests; public access
        is configured separately.
      </p>
    </>
  );
}
function LifecycleFields({
  rule,
  onChange,
}: {
  rule: LifecycleRule;
  onChange: (r: LifecycleRule) => void;
}) {
  return (
    <>
      <div className="grid items-end gap-4 sm:grid-cols-2">
        <Input
          label="Rule name"
          value={rule.id}
          onChange={(e) => onChange({ ...rule, id: e.target.value })}
        />
        <Checkbox
          label="Rule enabled"
          checked={rule.enabled}
          onCheckedChange={(enabled) => onChange({ ...rule, enabled })}
        />
      </div>
      <Input
        label="Object prefix"
        value={rule.conditions.prefix}
        placeholder="e.g. temporary/"
        description="Leave empty to apply to the entire bucket."
        onChange={(e) =>
          onChange({ ...rule, conditions: { ...rule.conditions, prefix: e.target.value } })
        }
      />
      <Checkbox
        label="Delete objects"
        checked={!!rule.deleteObjectsTransition}
        onCheckedChange={(checked) => {
          const next = { ...rule };
          if (checked)
            next.deleteObjectsTransition = { condition: { type: "Age", maxAge: 30 * days } };
          else delete next.deleteObjectsTransition;
          onChange(next);
        }}
      />
      {rule.deleteObjectsTransition && (
        <Condition
          label="Delete objects"
          value={rule.deleteObjectsTransition.condition}
          onChange={(condition) =>
            onChange({
              ...rule,
              deleteObjectsTransition: { ...rule.deleteObjectsTransition, condition },
            })
          }
        />
      )}
      <Checkbox
        label="Abort incomplete multipart uploads"
        checked={!!rule.abortMultipartUploadsTransition}
        onCheckedChange={(checked) => {
          const next = { ...rule };
          if (checked)
            next.abortMultipartUploadsTransition = { condition: { type: "Age", maxAge: 7 * days } };
          else delete next.abortMultipartUploadsTransition;
          onChange(next);
        }}
      />
      {rule.abortMultipartUploadsTransition && (
        <Condition
          label="Abort uploads"
          ageOnly
          value={rule.abortMultipartUploadsTransition.condition}
          onChange={(condition) => {
            if (condition.type === "Age")
              onChange({
                ...rule,
                abortMultipartUploadsTransition: {
                  ...rule.abortMultipartUploadsTransition,
                  condition,
                },
              });
          }}
        />
      )}
      {(rule.storageClassTransitions ?? []).map((transition, i) => (
        <div key={i} className="space-y-3 rounded-lg border border-kumo-line p-3">
          <p className="text-sm font-medium">Move to Infrequent Access</p>
          <Condition
            label={`Storage transition ${i + 1}`}
            value={transition.condition}
            onChange={(condition) =>
              onChange({
                ...rule,
                storageClassTransitions: rule.storageClassTransitions!.map((t, n) =>
                  n === i ? { ...t, condition } : t,
                ),
              })
            }
          />
          <Button
            type="button"
            size="sm"
            variant="ghost"
            onClick={() =>
              onChange({
                ...rule,
                storageClassTransitions: rule.storageClassTransitions!.filter((_, n) => n !== i),
              })
            }
          >
            Remove storage transition
          </Button>
        </div>
      ))}
      <Button
        type="button"
        size="sm"
        variant="secondary"
        onClick={() =>
          onChange({
            ...rule,
            storageClassTransitions: [
              ...(rule.storageClassTransitions ?? []),
              { storageClass: "InfrequentAccess", condition: { type: "Age", maxAge: 30 * days } },
            ],
          })
        }
      >
        Add storage transition
      </Button>
      <p className="text-xs text-kumo-subtle">
        Deletion is permanent and can affect existing objects. Ages are measured from object
        creation, or upload initiation for incomplete uploads. Infrequent Access can incur retrieval
        and minimum storage duration charges.
      </p>
    </>
  );
}
