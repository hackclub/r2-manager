"use client";
import { useActionState, useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@cloudflare/kumo/components/button";
import { Dialog } from "@cloudflare/kumo/components/dialog";
import { Input } from "@cloudflare/kumo/components/input";
import { Checkbox } from "@cloudflare/kumo/components/checkbox";
import { Radio } from "@cloudflare/kumo/components/radio";
import { Select } from "@cloudflare/kumo/components/select";
import { Table } from "@cloudflare/kumo/components/table";
import { Badge } from "@cloudflare/kumo/components/badge";
import { ClipboardText } from "@cloudflare/kumo/components/clipboard-text";
import { DropdownMenu } from "@cloudflare/kumo/components/dropdown";
import {
  PlusIcon,
  KeyIcon,
  CheckCircleIcon,
  DotsThreeIcon,
  XIcon,
  CopyIcon,
  DownloadSimpleIcon,
} from "@phosphor-icons/react";
import { createApiKey, revokeApiKey, rollApiKey } from "./actions";
import type { IssuedCredentials, KeySummary } from "@/lib/api-keys";
import { ConfirmDialog } from "@/app/confirm-dialog";
import { CopyValue } from "@/app/copy-value";
const DAY = 86400000;
const stamp = new Intl.DateTimeFormat("en-US", {
  month: "short",
  day: "numeric",
  year: "numeric",
  hour: "2-digit",
  minute: "2-digit",
  timeZone: "UTC",
});
const date = (v: string) => `${stamp.format(new Date(v))} UTC`;
const access = (p: string) => (p === "read" ? "Read only" : "Read / write");
const states = {
  active: ["Active", "success"],
  failed: ["Failed", "error"],
  revoke_pending: ["Revocation pending", "warning"],
} as const;
function status(k: KeySummary, now: number) {
  if (k.status === "revoked") return ["Revoked", "secondary"] as const;
  if (new Date(k.expires_at).getTime() <= now) return ["Expired", "secondary"] as const;
  return states[k.status as keyof typeof states] ?? (["Needs review", "warning"] as const);
}
export function ApiKeysPanel({
  bucket,
  buckets,
  keys,
  configured,
  endpoint,
  now,
}: {
  bucket: string;
  buckets: string[];
  keys: KeySummary[];
  configured: boolean;
  endpoint: string;
  now: number;
}) {
  const router = useRouter();
  const [flow, setFlow] = useState<string | null>(null);
  const [roll, setRoll] = useState<KeySummary | null>(null);
  const [revoke, setRevoke] = useState<KeySummary | null>(null);
  const [pending, start] = useTransition();
  const [error, setError] = useState("");
  const [clock, setClock] = useState(now);
  useEffect(() => {
    const t = setInterval(() => setClock(Date.now()), 30000);
    return () => clearInterval(t);
  }, []);
  const create = (variant: "primary" | "secondary") => (
    <Button
      variant={variant}
      icon={<PlusIcon />}
      disabled={!configured || !buckets.length}
      onClick={() => setFlow(crypto.randomUUID())}
    >
      Create API key
    </Button>
  );
  const close = (set: (v: null) => void) => () => {
    set(null);
    router.refresh();
  };
  return (
    <>
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-xl font-semibold">API Keys</h1>
          <p className="mt-2 max-w-2xl text-sm text-kumo-subtle">
            Key me up! These keys give your apps access to your Cloudflare R2 buckets.
          </p>
        </div>
        {create("primary")}
      </div>
      {!configured && (
        <p className="mt-6 rounded-lg border border-kumo-line p-4 text-sm">
          API key creation is not configured yet. Contact the administrator.
        </p>
      )}
      {bucket && !buckets.includes(bucket) && (
        <p className="mt-6 rounded-lg border border-kumo-line p-4 text-sm text-kumo-subtle">
          This bucket is not assigned to you. You can create keys only for buckets you own
          {buckets.length
            ? ", which you can select in the create-key dialog"
            : ". Ask an administrator to assign a bucket to you"}
          .
        </p>
      )}
      {!bucket && !buckets.length && (
        <p className="mt-6 text-sm text-kumo-subtle">
          Create a bucket before generating an API key. You can still revoke any existing keys
          below.
        </p>
      )}
      <section className="mt-5 overflow-x-auto rounded-lg border border-kumo-line">
        <Table aria-label="Your API keys" className="w-full text-sm">
          <Table.Header>
            <Table.Row>
              <Table.Head className="px-4 py-3">Name</Table.Head>
              <Table.Head>Access</Table.Head>
              <Table.Head>Buckets</Table.Head>
              <Table.Head>Expires</Table.Head>
              <Table.Head>Status</Table.Head>
              <Table.Head>
                <span className="sr-only">Actions</span>
              </Table.Head>
            </Table.Row>
          </Table.Header>
          <Table.Body>
            {keys.map((key) => {
              const [state, variant] = status(key, clock);
              return (
                <Table.Row key={key.id} className="border-t border-kumo-line">
                  <Table.Cell className="px-4 py-4">
                    <p className="font-medium">{key.name}</p>
                    <p className="mt-1 text-xs text-kumo-subtle">Created {date(key.created_at)}</p>
                    {key.cloudflare_id && (
                      <p className="mt-1 font-mono text-xs text-kumo-subtle">
                        …{key.cloudflare_id.slice(-8)}
                      </p>
                    )}
                  </Table.Cell>
                  <Table.Cell>
                    <Badge variant="secondary">{access(key.permission)}</Badge>
                  </Table.Cell>
                  <Table.Cell>
                    <div className="flex max-w-md flex-wrap gap-1 py-3">
                      {key.buckets.map((name) => (
                        <Badge key={name} variant="outline">
                          {name}
                        </Badge>
                      ))}
                    </div>
                  </Table.Cell>
                  <Table.Cell className="whitespace-nowrap text-kumo-subtle">
                    {date(key.expires_at)}
                  </Table.Cell>
                  <Table.Cell>
                    <Badge variant={variant}>{state}</Badge>
                  </Table.Cell>
                  <Table.Cell>
                    {state !== "Revoked" && (
                      <DropdownMenu>
                        <DropdownMenu.Trigger
                          render={
                            <Button
                              variant="ghost"
                              size="sm"
                              icon={<DotsThreeIcon />}
                              aria-label={`Actions for ${key.name}`}
                            />
                          }
                        />
                        <DropdownMenu.Content>
                          {state === "Active" && configured && (
                            <DropdownMenu.Item onClick={() => setRoll(key)}>
                              Roll key
                            </DropdownMenu.Item>
                          )}

                          <DropdownMenu.Item
                            variant="danger"
                            onClick={() => {
                              setError("");
                              setRevoke(key);
                            }}
                          >
                            Revoke key
                          </DropdownMenu.Item>
                        </DropdownMenu.Content>
                      </DropdownMenu>
                    )}
                  </Table.Cell>
                </Table.Row>
              );
            })}
          </Table.Body>
        </Table>
        {!keys.length && (
          <div className="flex min-h-56 flex-col items-center justify-center gap-3 p-8 text-center">
            <KeyIcon size={36} className="text-kumo-subtle" />
            <h2 className="font-medium">No keys yet!</h2>
            <p className="max-w-md text-sm text-kumo-subtle">
              Create an API key to connect your apps.
            </p>
            {create("secondary")}
          </div>
        )}
      </section>
      <section className="mt-6 max-w-3xl rounded-lg border border-kumo-line p-5">
        <h2 className="text-sm font-medium">S3 connection details</h2>
        <p className="mt-2 text-sm text-kumo-subtle">
          Use this endpoint with your access key ID and secret in any S3-compatible tool. These keys
          grant object access, without bucket or account administration.
        </p>
        {endpoint && (
          <dl className="mt-4 space-y-3 text-sm">
            <div>
              <dt className="mb-1 text-kumo-subtle">S3 endpoint</dt>
              <dd>
                <CopyValue value={endpoint} label="S3 endpoint" alwaysVisible />
              </dd>
            </div>
          </dl>
        )}
      </section>
      {flow && (
        <CreateKeyFlow
          requestId={flow}
          bucket={bucket}
          buckets={buckets}
          onClose={close(setFlow)}
        />
      )}
      {roll && <RollKeyFlow item={roll} onClose={close(setRoll)} />}
      <ConfirmDialog
        open={!!revoke}
        onOpenChange={(open) => {
          if (!open) setRevoke(null);
        }}
        title={`Revoke ${revoke?.name}?`}
        description={`Apps using this key will lose access to ${revoke?.buckets.join(", ")} instantly. This cannot be undone.`}
        confirmLabel="Revoke key"
        pending={pending}
        error={error}
        onConfirm={() =>
          start(async () => {
            if (!revoke) return;
            const e = await revokeApiKey(revoke.id).catch(() => "Could not revoke key. Try again.");
            if (e) setError(e);
            else close(setRevoke)();
          })
        }
      />
    </>
  );
}
function RollKeyFlow({ item, onClose }: { item: KeySummary; onClose: () => void }) {
  const [pending, start] = useTransition();
  const [error, setError] = useState("");
  const [credentials, setCredentials] = useState<IssuedCredentials | null>(null);
  const [saved, setSaved] = useState(false);
  const blocked = pending || (!!credentials && !saved);
  return (
    <Dialog.Root
      open
      onOpenChange={(open) => {
        if (!open && !blocked) onClose();
      }}
    >
      <Dialog size="lg" className="max-h-[90dvh] overflow-y-auto p-6">
        <div className="flex items-start justify-between gap-4">
          <Dialog.Title className="text-xl font-semibold">
            {credentials ? "API key rolled" : `Roll ${item.name}?`}
          </Dialog.Title>
          <Close label="Close roll API key" disabled={blocked} onClose={onClose} />
        </div>
        <Dialog.Description className="mt-3 text-sm text-kumo-subtle">
          {credentials
            ? "Save the new key now! You will not be able to see it after!"
            : "Rolling permanently invalidates the current secret. Update every app using this key with the new secret. The access key ID, buckets, permissions, and expiry stay the same."}
        </Dialog.Description>
        {credentials ? (
          <Issued credentials={credentials} saved={saved} setSaved={setSaved} onClose={onClose} />
        ) : (
          <>
            {error && (
              <p className="mt-4 text-sm text-kumo-danger" role="alert">
                {error}
              </p>
            )}
            <div className="mt-6 flex justify-end gap-2">
              <Button variant="secondary" disabled={pending} onClick={onClose}>
                Cancel
              </Button>
              <Button
                variant="destructive"
                loading={pending}
                onClick={() =>
                  start(async () => {
                    setError("");
                    const r = await rollApiKey(item.id).catch(() => ({
                      credentials: undefined,
                      error:
                        "The roll could not be confirmed. The old secret may already be invalid. Roll again or revoke the key.",
                    }));
                    if (r.credentials) setCredentials(r.credentials);
                    else setError(r.error || "Could not roll key.");
                  })
                }
              >
                Roll key
              </Button>
            </div>
          </>
        )}
      </Dialog>
    </Dialog.Root>
  );
}
function CreateKeyFlow({
  requestId,
  bucket,
  buckets,
  onClose,
}: {
  requestId: string;
  bucket: string;
  buckets: string[];
  onClose: () => void;
}) {
  const [result, action, pending] = useActionState(createApiKey, null);
  const [selected, setSelected] = useState<Set<string>>(
    new Set(buckets.includes(bucket) ? [bucket] : !bucket && buckets.length === 1 ? buckets : []),
  );
  const [search, setSearch] = useState("");
  const [permission, setPermission] = useState("read");
  const [duration, setDuration] = useState("365");
  const [custom, setCustom] = useState("");
  const [saved, setSaved] = useState(false);
  const [opened] = useState(() => Date.now());
  const issued = result?.credentials;
  const blocked = pending || (!!issued && !saved);
  const expiry = new Date(custom);
  const t = expiry.getTime();
  const valid = Number.isFinite(t) && t > opened + 60000 && t <= opened + 365 * DAY;
  const local = (n: number) =>
    new Date(n - new Date(n).getTimezoneOffset() * 60000).toISOString().slice(0, 16);
  const matches = buckets.filter((b) => b.includes(search.toLowerCase()));
  return (
    <Dialog.Root
      open
      onOpenChange={(open) => {
        if (!open && !blocked) onClose();
      }}
    >
      <Dialog size="xl" className="max-h-[90dvh] overflow-y-auto p-6 sm:p-7">
        <div className="flex items-start justify-between gap-4">
          <div>
            <Dialog.Title className="flex items-center gap-2 text-xl font-semibold">
              {issued ? (
                <>
                  <CheckCircleIcon className="text-kumo-success" size={24} />
                  API key created
                </>
              ) : (
                <>
                  <KeyIcon size={22} />
                  Create API key
                </>
              )}
            </Dialog.Title>
            <Dialog.Description className="mt-2 text-sm text-kumo-subtle">
              {issued
                ? "Copy and save your keys now! You will never be able to see these again!"
                : "Set permissions, buckets, and expiry."}
            </Dialog.Description>
          </div>
          <Close label="Close create API key" disabled={blocked} onClose={onClose} />
        </div>
        {issued ? (
          <Issued credentials={issued} saved={saved} setSaved={setSaved} onClose={onClose} />
        ) : (
          <form action={action} className="mt-6 space-y-6">
            <input type="hidden" name="requestId" value={requestId} />
            <input type="hidden" name="permission" value={permission} />
            <input type="hidden" name="duration" value={duration} />
            <input type="hidden" name="expiresAt" value={valid ? expiry.toISOString() : ""} />
            {Array.from(selected).map((name) => (
              <input key={name} type="hidden" name="buckets" value={name} />
            ))}
            <Input
              label="Key name"
              name="name"
              placeholder="e.g. Website uploads or Backup reader"
              required
              maxLength={60}
              description="A name to help you recognize this connection later."
            />
            <Radio.Group
              legend="Permissions"
              value={permission}
              onValueChange={(value) => setPermission(value as string)}
            >
              <Radio.Item
                value="read"
                label="Read only"
                description="List and download objects. Ideal for readers and downloads."
              />
              <Radio.Item
                value="read-write"
                label="Read / write"
                description="List, download, upload, replace, and delete objects."
              />
            </Radio.Group>
            <p className="-mt-3 text-xs text-kumo-subtle">
              {permission === "read"
                ? "List and download objects. Uploads, changes, and deletes are blocked."
                : "List, download, upload, replace, and delete objects."}
            </p>
            <fieldset>
              <legend className="text-sm font-medium">
                Bucket access <span className="text-kumo-subtle">· {selected.size} selected</span>
              </legend>
              <p className="mt-1 text-xs text-kumo-subtle">
                Only buckets assigned to you are available. New buckets are never added
                automatically.
              </p>
              <div className="mt-3 rounded-lg border border-kumo-line">
                <div className="flex items-center gap-2 border-b border-kumo-line p-3">
                  <Input
                    aria-label="Filter your buckets"
                    placeholder="Find a bucket…"
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    className="min-w-0 flex-1"
                  />
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() =>
                      setSelected(selected.size === buckets.length ? new Set() : new Set(buckets))
                    }
                  >
                    {selected.size === buckets.length ? "Clear all" : "Select all"}
                  </Button>
                </div>
                <div className="max-h-52 space-y-1 overflow-y-auto p-3">
                  {matches.map((name) => (
                    <div key={name} className="rounded-md px-2 py-2 hover:bg-kumo-tint">
                      <Checkbox
                        label={name}
                        checked={selected.has(name)}
                        onCheckedChange={(on) =>
                          setSelected((old) => {
                            const next = new Set(old);
                            next[on ? "add" : "delete"](name);
                            return next;
                          })
                        }
                      />
                    </div>
                  ))}
                  {!matches.length && (
                    <p className="p-2 text-sm text-kumo-subtle">No matching buckets.</p>
                  )}
                </div>
              </div>
            </fieldset>
            <div>
              <Select
                label="Expires after"
                value={duration}
                onValueChange={(value) => setDuration(value ?? "365")}
                items={{
                  "365": "1 year (365 days)",
                  "90": "90 days",
                  "30": "30 days",
                  "7": "7 days",
                  "1": "1 day",
                  custom: "Custom date and time",
                }}
                className="w-full"
              />
              <p className="mt-2 text-xs text-kumo-subtle">
                One year is the default and maximum. Choose a shorter duration whenever possible.
              </p>
              {duration === "custom" && (
                <div className="mt-3">
                  <Input
                    label="Expiry date and time"
                    type="datetime-local"
                    value={custom}
                    onChange={(e) => setCustom(e.target.value)}
                    min={local(opened + 60000)}
                    max={local(opened + 365 * DAY)}
                    required
                    description="Uses your local time zone. Minimum one minute; maximum 365 days."
                  />
                </div>
              )}
            </div>
            {result?.error && (
              <p
                className="rounded-lg border border-kumo-line p-3 text-sm text-kumo-danger"
                role="alert"
              >
                {result.error}
              </p>
            )}
            <div className="flex flex-wrap items-center justify-between gap-3 border-t border-kumo-line pt-5">
              <p className="text-xs text-kumo-subtle">
                {access(permission)} · {selected.size} bucket
                {selected.size === 1 ? "" : "s"} ·{" "}
                {duration === "custom" ? "Custom expiry" : `${duration} days`}
              </p>
              <div className="flex gap-2">
                <Button variant="secondary" type="button" disabled={pending} onClick={onClose}>
                  Cancel
                </Button>
                <Button
                  type="submit"
                  variant="primary"
                  loading={pending}
                  disabled={!selected.size || (duration === "custom" && !valid)}
                >
                  Create API key
                </Button>
              </div>
            </div>
          </form>
        )}
      </Dialog>
    </Dialog.Root>
  );
}
function Credentials({ credentials: c }: { credentials: IssuedCredentials }) {
  const [message, setMessage] = useState("");
  const copyEnv = () =>
    navigator.clipboard
      .writeText(
        `AWS_ACCESS_KEY_ID=${c.accessKeyId}\nAWS_SECRET_ACCESS_KEY=${c.secretAccessKey}\nAWS_DEFAULT_REGION=auto\nAWS_ENDPOINT_URL_S3=${c.endpoint}\n`,
      )
      .then(
        () => setMessage("Environment copied"),
        () => setMessage("Could not copy. Use the individual copy buttons."),
      );
  function download() {
    const url = URL.createObjectURL(
      new Blob([JSON.stringify(c, null, 2)], { type: "application/json" }),
    );
    Object.assign(document.createElement("a"), {
      href: url,
      download: "r2-credentials.json",
    }).click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }
  return (
    <div className="mt-6 space-y-5">
      <div className="rounded-lg border border-kumo-line bg-kumo-success-tint p-4 text-sm">
        <p className="font-medium">{c.name}</p>
        <p className="mt-1 text-kumo-subtle">
          {access(c.permission)} · {c.buckets.join(", ")}
          <br />
          Expires {date(c.expiresAt)}
        </p>
      </div>
      {(
        [
          ["Access key ID", c.accessKeyId],
          ["Secret access key", c.secretAccessKey, true],
          ["S3 endpoint", c.endpoint],
          ["Region", c.region],
        ] as const
      ).map(([label, value, masked]) => (
        <div key={label}>
          <p className="mb-2 text-sm font-medium">{label}</p>
          <ClipboardText
            text={value}
            masked={!!masked}
            labels={{ copyAction: `Copy ${label}` }}
            tooltip={{ text: `Copy ${label}`, copiedText: "Copied" }}
            className="w-full"
          />
        </div>
      ))}
      <div className="flex flex-wrap items-center gap-2">
        <Button variant="secondary" icon={<CopyIcon />} onClick={copyEnv}>
          Copy .env
        </Button>
        <Button variant="secondary" icon={<DownloadSimpleIcon />} onClick={download}>
          Download credentials
        </Button>
        {message && <output className="text-xs text-kumo-success">{message}</output>}
      </div>
      <div className="rounded-lg border border-kumo-line p-4">
        <p className="mb-2 text-sm font-medium">Try it with the AWS CLI</p>
        <p className="mb-3 text-xs text-kumo-subtle">
          Export the environment variables above, then run:
        </p>
        <CopyValue
          value={`aws s3 ls s3://${c.buckets[0]} --endpoint-url ${c.endpoint}`}
          label="AWS CLI example"
          alwaysVisible
        />
      </div>
    </div>
  );
}
function Close({
  label,
  disabled,
  onClose,
}: {
  label: string;
  disabled: boolean;
  onClose: () => void;
}) {
  return (
    <Button
      variant="ghost"
      icon={<XIcon />}
      aria-label={label}
      disabled={disabled}
      onClick={onClose}
    />
  );
}
function Issued({
  credentials,
  saved,
  setSaved,
  onClose,
}: {
  credentials: IssuedCredentials;
  saved: boolean;
  setSaved: (v: boolean) => void;
  onClose: () => void;
}) {
  return (
    <>
      <Credentials credentials={credentials} />
      <div className="mt-6 border-t border-kumo-line pt-5">
        <Checkbox
          label="I have saved these credentials."
          checked={saved}
          onCheckedChange={setSaved}
        />
        <div className="mt-4 flex justify-end">
          <Button variant="primary" disabled={!saved} onClick={onClose}>
            Done
          </Button>
        </div>
      </div>
    </>
  );
}
