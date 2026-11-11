"use client";
import { useEffect, useRef, useState } from "react";
import Editor, { loader, type Monaco, type OnMount } from "@monaco-editor/react";
import type { editor } from "monaco-editor";
import { Button } from "@cloudflare/kumo/components/button";
import { corsSchema } from "@/lib/cors-schema";

loader.config({ paths: { vs: "/monaco/vs" } });

export default function CorsEditor({
  value,
  onChange,
  onValidityChange,
  bucket,
}: {
  value: string;
  onChange: (value: string) => void;
  onValidityChange: (valid: boolean) => void;
  bucket: string;
}) {
  const instance = useRef<editor.IStandaloneCodeEditor | null>(null);
  const [ready, setReady] = useState(false);
  const [dark, setDark] = useState(true);
  const [problems, setProblems] = useState<string[]>([]);
  useEffect(() => {
    const el = document.documentElement;
    const sync = () => setDark(el.dataset.mode === "dark");
    sync();
    const o = new MutationObserver(sync);
    o.observe(el, { attributes: true, attributeFilter: ["data-mode"] });
    return () => o.disconnect();
  }, []);
  const check = (text: string) => {
    try {
      onValidityChange(Array.isArray(JSON.parse(text)));
    } catch {
      onValidityChange(false);
    }
  };
  const configure = (monaco: Monaco) =>
    monaco.json.jsonDefaults.setDiagnosticsOptions({
      validate: true,
      allowComments: false,
      trailingCommas: "error",
      enableSchemaRequest: false,
      schemas: [
        {
          uri: "https://r2-manager.invalid/schemas/cors.json",
          fileMatch: ["inmemory://r2-cors/*"],
          schema: corsSchema,
        },
      ],
    });
  const mount: OnMount = (e) => {
    instance.current = e;
    setReady(true);
    check(value);
  };
  return (
    <div className="grid h-[466px] grid-rows-[40px_360px_64px] overflow-hidden rounded-lg border border-kumo-line">
      <div className="flex items-center justify-between gap-3 border-b border-kumo-line bg-kumo-base px-3 py-2">
        <span className="font-mono text-xs text-kumo-subtle">cors.json</span>
        <Button
          type="button"
          size="sm"
          variant="ghost"
          disabled={!ready}
          onClick={() => instance.current?.getAction("editor.action.formatDocument")?.run()}
        >
          Format JSON
        </Button>
      </div>
      <Editor
        height="360px"
        language="json"
        path={`inmemory://r2-cors/${encodeURIComponent(bucket)}.json`}
        value={value}
        beforeMount={configure}
        onMount={mount}
        onChange={(next = "") => {
          onChange(next);
          check(next);
        }}
        onValidate={(markers) => {
          const errors = markers.filter((m) => m.severity >= 4);
          setProblems(errors.map((m) => `Line ${m.startLineNumber}: ${m.message}`));
          onValidityChange(!errors.length);
        }}
        theme={dark ? "vs-dark" : "light"}
        loading={
          <div className="flex h-[360px] items-center justify-center bg-kumo-base text-sm text-kumo-subtle">
            Loading JSON editor…
          </div>
        }
        options={{
          ariaLabel: "CORS rules JSON editor",
          automaticLayout: true,
          minimap: { enabled: false },
          fontSize: 13,
          lineNumbers: "on",
          scrollBeyondLastLine: false,
          wordWrap: "on",
          tabSize: 2,
          insertSpaces: true,
          formatOnPaste: true,
          formatOnType: true,
          folding: true,
          renderValidationDecorations: "on",
          padding: { top: 12, bottom: 12 },
          stickyScroll: { enabled: false },
        }}
      />
      <div
        className="overflow-auto border-t border-kumo-line px-3 py-2 text-xs text-kumo-subtle"
        aria-live="polite"
      >
        {problems.length ? (
          <ul className="space-y-1">
            {problems.slice(0, 3).map((p, i) => (
              <li key={i}>{p}</li>
            ))}
            {problems.length > 3 && <li>{problems.length - 3} more problems</li>}
          </ul>
        ) : ready ? (
          "JSON · Ctrl/Cmd+Space for suggestions · Empty array [] removes all CORS rules"
        ) : (
          "Preparing JSON validation…"
        )}
      </div>
    </div>
  );
}
