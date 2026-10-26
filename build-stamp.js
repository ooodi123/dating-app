// Отпечаток исходников: по нему start.js понимает, что собранный код устарел, и пересобирает его.
// `node build-stamp.js` записывает отпечаток после сборки (его вызывает `npm run setup`).
import { createHash } from "node:crypto";
import { existsSync, readdirSync, readFileSync, statSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL(".", import.meta.url));
const SOURCES = ["server/src", "server/package.json", "webapp/src", "webapp/index.html", "webapp/package.json"];
export const stampFile = join(root, "server/dist/.source-hash");

function files(path) {
  if (!existsSync(path)) return [];
  if (!statSync(path).isDirectory()) return [path];
  return readdirSync(path).sort().flatMap((name) => files(join(path, name)));
}

export function sourceHash() {
  const hash = createHash("sha256");
  for (const file of SOURCES.flatMap((p) => files(join(root, p)))) {
    hash.update(file.slice(root.length)).update(readFileSync(file));
  }
  return hash.digest("hex").slice(0, 12);
}

export function builtHash() {
  return existsSync(stampFile) ? readFileSync(stampFile, "utf8").trim() : null;
}

if (process.argv[1] === fileURLToPath(import.meta.url)) writeFileSync(stampFile, sourceHash());
