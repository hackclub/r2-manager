import { cp, mkdir } from "node:fs/promises";
import { createRequire } from "node:module";
import path from "node:path";
const require = createRequire(import.meta.url);
const source = path.dirname(require.resolve("monaco-editor"));
await mkdir("public/monaco", { recursive: true });
await cp(source, "public/monaco/vs", { recursive: true });
