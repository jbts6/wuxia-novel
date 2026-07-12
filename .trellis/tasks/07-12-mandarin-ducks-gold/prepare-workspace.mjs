import { createHash } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, statSync, writeFileSync } from "node:fs";
import { basename, relative, resolve } from "node:path";

const [sourceArg, archiveArg, outputArg] = process.argv.slice(2);

if (!sourceArg || !archiveArg || !outputArg) {
  console.error("Usage: node prepare-workspace.mjs <source.txt> <archive-dir> <output-dir>");
  process.exit(1);
}

const sourcePath = resolve(sourceArg);
const archivePath = resolve(archiveArg);
const outputPath = resolve(outputArg);

if (!existsSync(sourcePath) || !statSync(sourcePath).isFile()) {
  throw new Error(`Source file does not exist: ${sourcePath}`);
}

if (!existsSync(archivePath) || !statSync(archivePath).isDirectory()) {
  throw new Error(`Archive directory does not exist: ${archivePath}`);
}

const sourceBuffer = readFileSync(sourcePath);
const sourceText = sourceBuffer.toString("utf8");
const sourceHash = createHash("sha256").update(sourceBuffer).digest("hex");
const hasTrailingLf = sourceText.endsWith("\n");
const sourceLines = sourceText.split("\n");

if (hasTrailingLf) {
  sourceLines.pop();
}

const lineNumberWidth = Math.max(6, String(sourceLines.length).length);
const numberedText =
  sourceLines
    .map((line, index) => `${String(index + 1).padStart(lineNumberWidth, "0")}\t${line}`)
    .join("\n") + (hasTrailingLf ? "\n" : "");

const numberedLines = numberedText.split("\n");
if (hasTrailingLf) {
  numberedLines.pop();
}

const restoredText =
  numberedLines
    .map((line, index) => {
      const prefix = `${String(index + 1).padStart(lineNumberWidth, "0")}\t`;
      if (!line.startsWith(prefix)) {
        throw new Error(`Invalid generated line prefix at line ${index + 1}`);
      }
      return line.slice(prefix.length);
    })
    .join("\n") + (hasTrailingLf ? "\n" : "");

if (restoredText !== sourceText) {
  throw new Error("Numbered source failed the reversible-content check");
}

mkdirSync(outputPath, { recursive: true });

const manifestPath = resolve(outputPath, "source-manifest.json");
if (existsSync(manifestPath)) {
  const existingManifest = JSON.parse(readFileSync(manifestPath, "utf8"));
  if (existingManifest.source_hash !== sourceHash) {
    throw new Error("Existing workspace belongs to a different source hash");
  }
}

writeFileSync(resolve(outputPath, "source-numbered.txt"), numberedText, "utf8");

for (const ledger of ["events.jsonl", "entities.jsonl", "dialogues.jsonl", "uncertainties.jsonl"]) {
  const ledgerPath = resolve(outputPath, ledger);
  if (!existsSync(ledgerPath)) {
    writeFileSync(ledgerPath, "", "utf8");
  }
}

const existingManifest = existsSync(manifestPath)
  ? JSON.parse(readFileSync(manifestPath, "utf8"))
  : null;
const manifest = {
  schema_version: "1.0",
  novel: basename(sourcePath, ".txt"),
  provenance: "human_curated_working",
  source_path: relative(process.cwd(), sourcePath),
  source_hash: sourceHash,
  source_bytes: sourceBuffer.byteLength,
  source_characters: Array.from(sourceText).length,
  physical_lines: sourceLines.length,
  line_number_width: lineNumberWidth,
  archive_path: relative(process.cwd(), archivePath),
  blind_status: "sealed",
  workflow_state: existingManifest?.workflow_state ?? "initialized",
  created_at: existingManifest?.created_at ?? new Date().toISOString(),
  updated_at: new Date().toISOString(),
};

writeFileSync(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`, "utf8");

console.log(
  JSON.stringify({
    output_path: relative(process.cwd(), outputPath),
    source_hash: sourceHash,
    source_bytes: sourceBuffer.byteLength,
    source_characters: manifest.source_characters,
    physical_lines: sourceLines.length,
    reversible: true,
  }),
);
