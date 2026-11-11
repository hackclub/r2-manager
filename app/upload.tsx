"use client";
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { useRouter } from "next/navigation";
import { Button } from "@cloudflare/kumo/components/button";
import { Meter } from "@cloudflare/kumo/components/meter";
import { UploadSimpleIcon, CheckCircleIcon, WarningCircleIcon, XIcon } from "@phosphor-icons/react";
import { createUploadUrl } from "./object-actions";
import { formatBytes } from "@/lib/format";

type Job = { file: File; bucket: string; prefix: string };
type Activity = {
  name: string;
  target: string;
  loaded: number;
  size: number;
  preparing: boolean;
  completed: number;
  total: number;
};
const UploadContext = createContext<{ choose: () => void; busy: boolean } | null>(null);
const MAX_UPLOAD = 300 * 1024 * 1024;
export function UploadProvider({
  bucket,
  prefix,
  children,
}: {
  bucket: string;
  prefix: string;
  children: ReactNode;
}) {
  const router = useRouter();
  const input = useRef<HTMLInputElement>(null);
  const queue = useRef<Job[]>([]);
  const running = useRef(false);
  const alive = useRef(true);
  const request = useRef<XMLHttpRequest | null>(null);
  const generation = useRef(0);
  const dragDepth = useRef(0);
  const batch = useRef({ total: 0, completed: 0, failed: 0 });
  const [dragging, setDragging] = useState(false);
  const [activity, setActivity] = useState<Activity | null>(null);
  const [summary, setSummary] = useState("");
  const [errors, setErrors] = useState<string[]>([]);
  const stop = () => {
    generation.current++;
    queue.current = [];
    request.current?.abort();
  };
  useEffect(() => {
    alive.current = true;
    return () => {
      alive.current = false;
      stop();
    };
  }, []);
  const current = (v: number) => alive.current && v === generation.current;
  const patch = (p: Partial<Activity>) => setActivity((a) => a && { ...a, ...p });
  const fail = (e: string) => setErrors((old) => [...old, e]);
  const drain = useCallback(async () => {
    let uploaded = false;
    while (queue.current.length && alive.current) {
      const job = queue.current.shift()!;
      const version = generation.current;
      setActivity({
        name: job.file.name,
        target: `${job.bucket}/${job.prefix}`,
        loaded: 0,
        size: job.file.size,
        preparing: true,
        completed: batch.current.completed,
        total: batch.current.total,
      });
      try {
        const { url, error } = await createUploadUrl(
          job.bucket,
          job.prefix + job.file.name,
          job.file.size,
        );
        if (!current(version)) continue;
        if (!url) throw new Error(error || "Could not prepare upload.");
        patch({ preparing: false });
        await new Promise<void>((resolve, reject) => {
          const xhr = new XMLHttpRequest();
          request.current = xhr;
          let frame: number | undefined;
          let loaded = 0;
          const end = (err?: string) => () => {
            if (frame !== undefined) cancelAnimationFrame(frame);
            if (request.current === xhr) request.current = null;
            if (!err && xhr.status >= 200 && xhr.status < 300) resolve();
            else
              reject(
                new Error(err || "Upload failed. Check the bucket CORS policy and try again."),
              );
          };
          xhr.open("PUT", url);
          xhr.upload.onprogress = (e) => {
            loaded = e.loaded;
            frame ??= requestAnimationFrame(() => {
              frame = undefined;
              if (current(version)) patch({ loaded });
            });
          };
          xhr.onload = end();
          xhr.onerror = end("Upload failed. Check your connection and the bucket CORS policy.");
          xhr.onabort = end("Upload canceled.");
          xhr.send(job.file);
        });
        if (!current(version)) continue;
        uploaded = true;
        batch.current.completed++;
      } catch (error) {
        if (current(version)) {
          batch.current.failed++;
          fail(`${job.file.name}: ${error instanceof Error ? error.message : "Upload failed."}`);
        }
      }
    }
    running.current = false;
    if (alive.current) {
      setActivity(null);
      if (batch.current.total) {
        const { completed, failed } = batch.current;
        setSummary(
          `${completed} file${completed === 1 ? "" : "s"} uploaded${failed ? ` · ${failed} failed` : ""}.`,
        );
      }
      if (uploaded) router.refresh();
    }
  }, [router]);
  const enqueue = useCallback(
    (files: File[], folderSkipped = false) => {
      if (!running.current) {
        batch.current = { total: 0, completed: 0, failed: 0 };
        setErrors([]);
        setSummary("");
      }
      if (folderSkipped) fail("Folder uploads are not supported. Drop individual files instead.");
      const accepted = files.filter(
        (f) => f.size <= MAX_UPLOAD || (fail(`${f.name} exceeds the 300 MB upload limit.`), false),
      );
      queue.current.push(...accepted.map((file) => ({ file, bucket, prefix })));
      batch.current.total += accepted.length;
      patch({ total: batch.current.total });
      if (accepted.length && !running.current) {
        running.current = true;
        void drain();
      }
    },
    [bucket, prefix, drain],
  );
  useEffect(() => {
    const reset = () => {
      dragDepth.current = 0;
      setDragging(false);
    };
    // Only react to drags that carry files.
    const files = (f: (e: DragEvent) => void) => (e: Event) => {
      if ((e as DragEvent).dataTransfer?.types.includes("Files")) f(e as DragEvent);
    };
    const handlers: Record<string, (e: Event) => void> = {
      dragenter: files((e) => {
        e.preventDefault();
        dragDepth.current++;
        setDragging(true);
      }),
      dragover: files((e) => {
        e.preventDefault();
        e.dataTransfer!.dropEffect = "copy";
        setDragging(true);
      }),
      dragleave: files(() => {
        dragDepth.current = Math.max(0, dragDepth.current - 1);
        if (!dragDepth.current) setDragging(false);
      }),
      drop: files((e) => {
        e.preventDefault();
        reset();
        const t = e.dataTransfer!;
        let skipped = false;
        const items = Array.from(t.items || []).filter((i) => i.kind === "file");
        enqueue(
          items.length
            ? items.flatMap((i) => {
                const f = i.getAsFile();
                if (i.webkitGetAsEntry?.()?.isDirectory) skipped = true;
                else if (f) return [f];
                return [];
              })
            : Array.from(t.files),
          skipped,
        );
      }),
      dragend: reset,
      blur: reset,
      keydown: (e) => (e as KeyboardEvent).key === "Escape" && reset(),
    };
    for (const [k, h] of Object.entries(handlers)) window.addEventListener(k, h);
    return () => {
      for (const [k, h] of Object.entries(handlers)) window.removeEventListener(k, h);
    };
  }, [enqueue]);
  function cancel() {
    stop();
    batch.current = { total: 0, completed: 0, failed: 0 };
    setActivity(null);
    setSummary("Uploads canceled.");
  }
  const canceled = summary === "Uploads canceled.";
  const [icon, heading] = activity
    ? [<UploadSimpleIcon key="u" size={18} />, "Uploading files"]
    : canceled
      ? [<XIcon key="x" size={18} className="text-kumo-subtle" />, "Upload canceled"]
      : errors.length
        ? [<WarningCircleIcon key="w" size={18} className="text-kumo-danger" />, "Upload results"]
        : [<CheckCircleIcon key="c" size={18} className="text-kumo-success" />, "Upload complete"];
  const progress = activity?.size
    ? Math.min(100, Math.round((activity.loaded / activity.size) * 100))
    : 0;
  return (
    <UploadContext.Provider value={{ choose: () => input.current?.click(), busy: !!activity }}>
      <input
        ref={input}
        type="file"
        multiple
        className="sr-only"
        aria-label="Choose files to upload"
        onChange={(e) => {
          enqueue(Array.from(e.target.files || []));
          e.target.value = "";
        }}
      />
      {children}
      {dragging && (
        <div
          className="pointer-events-none fixed inset-0 z-50 flex items-center justify-center bg-kumo-base/75 p-6 backdrop-blur-sm"
          aria-live="polite"
          aria-atomic="true"
        >
          <div className="flex max-w-lg flex-col items-center gap-3 rounded-xl border-2 border-dashed border-kumo-brand bg-kumo-base p-10 text-center shadow-xl">
            <UploadSimpleIcon size={56} className="text-kumo-link motion-safe:animate-pulse" />
            <h2 className="text-2xl font-semibold">Release to upload</h2>
            <p className="max-w-sm break-all text-sm text-kumo-subtle">
              {activity ? "Add files to the upload queue for" : "Upload to"} {bucket}/{prefix}
            </p>
            <p className="text-xs text-kumo-subtle">One or more files · Up to 300 MB per file</p>
          </div>
        </div>
      )}
      {(activity || summary || errors.length > 0) && (
        <aside
          aria-label="Upload activity"
          className="fixed bottom-5 right-5 z-40 w-[calc(100%-2.5rem)] max-w-sm rounded-lg border border-kumo-line bg-kumo-base p-4 shadow-xl"
        >
          <div className="flex items-center justify-between gap-3">
            <h2 className="flex items-center gap-2 text-sm font-medium">
              {icon}
              {heading}
            </h2>
            {!activity && (
              <Button
                aria-label="Dismiss upload results"
                variant="ghost"
                size="sm"
                icon={<XIcon />}
                onClick={() => {
                  setSummary("");
                  setErrors([]);
                }}
              />
            )}
          </div>
          {activity ? (
            <>
              <p className="mt-3 truncate text-sm" title={activity.name}>
                {activity.name}
              </p>
              <p className="mt-1 truncate text-xs text-kumo-subtle" title={activity.target}>
                {activity.target}
              </p>
              <div className="mt-3">
                <Meter
                  label={
                    activity.preparing
                      ? "Preparing upload…"
                      : `File ${activity.completed + 1} of ${activity.total}`
                  }
                  value={progress}
                  customValue={activity.preparing ? "" : `${progress}%`}
                />
              </div>
              <p className="mt-2 text-xs text-kumo-subtle">
                {formatBytes(activity.loaded)} / {formatBytes(activity.size)}
              </p>
              <Button className="mt-3" size="sm" variant="ghost" onClick={cancel}>
                Cancel uploads
              </Button>
            </>
          ) : (
            summary && (
              <output
                className={`mt-3 block text-sm ${canceled ? "text-kumo-subtle" : errors.length ? "text-kumo-default" : "text-kumo-success"}`}
              >
                {summary}
              </output>
            )
          )}
          {errors.length > 0 && (
            <ul
              className="mt-3 max-h-32 space-y-1 overflow-auto text-xs text-kumo-danger"
              aria-live="polite"
            >
              {errors.map((e, i) => (
                <li key={i}>{e}</li>
              ))}
            </ul>
          )}
        </aside>
      )}
    </UploadContext.Provider>
  );
}
export function Upload({ dropzone = false }: { dropzone?: boolean }) {
  const upload = useContext(UploadContext);
  if (!upload) throw new Error("Upload must be used within an UploadProvider");
  return (
    <div
      className={
        dropzone
          ? "flex min-h-64 flex-col items-center justify-center gap-3 p-8 text-center"
          : "flex items-center gap-3"
      }
    >
      {dropzone && (
        <>
          <UploadSimpleIcon size={48} className="text-kumo-subtle" />
          <p className="mt-2 text-sm">Drop files anywhere to upload</p>
          <p className="text-sm text-kumo-subtle">Or select files from your computer.</p>
        </>
      )}
      <Button
        type="button"
        variant={dropzone ? "primary" : "secondary"}
        icon={dropzone ? undefined : <UploadSimpleIcon />}
        onClick={upload.choose}
      >
        {dropzone ? "Select from computer" : "Upload"}
      </Button>
      {dropzone && (
        <p className="text-xs text-kumo-subtle">Up to 300 MB per file. Multiple files supported.</p>
      )}
    </div>
  );
}
