import fs from "node:fs";
import path from "node:path";
import zlib from "node:zlib";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const reportHtml = path.resolve(__dirname, "..", "..", "playwright-report", "index.html");

function extractEmbeddedZipBase64(html) {
  const m = html.match(/<script id="playwrightReportBase64"[^>]*>data:application\/zip;base64,([\s\S]*?)<\/script>/i);
  if (!m) throw new Error("playwright_report_base64_not_found");
  return m[1].replace(/\s+/g, "");
}

function* iterZipLocalFiles(buf) {
  const SIG = 0x04034b50;
  let off = 0;
  while (off + 30 < buf.length) {
    if (buf.readUInt32LE(off) !== SIG) {
      off += 1;
      continue;
    }
    const flags = buf.readUInt16LE(off + 6);
    const method = buf.readUInt16LE(off + 8);
    const compSize = buf.readUInt32LE(off + 18);
    const nameLen = buf.readUInt16LE(off + 26);
    const extraLen = buf.readUInt16LE(off + 28);
    const name = buf.slice(off + 30, off + 30 + nameLen).toString("utf8");
    const dataStart = off + 30 + nameLen + extraLen;
    if (flags & 0x08) {
      throw new Error(`zip_uses_data_descriptor_unhandled_for_${name}`);
    }
    const dataEnd = dataStart + compSize;
    const comp = buf.slice(dataStart, dataEnd);
    let data;
    if (method === 0) data = comp;
    else if (method === 8) data = zlib.inflateRawSync(comp);
    else throw new Error(`zip_method_${method}_unsupported_for_${name}`);
    yield { name, data };
    off = dataEnd;
  }
}

function collectFailedTestsFromJson(json) {
  const failed = [];
  const visit = (node) => {
    if (!node || typeof node !== "object") return;
    if (Array.isArray(node)) {
      for (const x of node) visit(x);
      return;
    }
    if (node.type === "test" && node.outcome === "unexpected") {
      failed.push({
        title: node.title,
        path: Array.isArray(node.location?.file) ? node.location.file.join("/") : node.location?.file,
        location: node.location,
        errors: node.results?.flatMap((r) => (r.errors ?? [])).map((e) => e.message).filter(Boolean) ?? [],
      });
    }
    for (const v of Object.values(node)) visit(v);
  };
  visit(json);
  return failed;
}

const html = fs.readFileSync(reportHtml, "utf8");
const b64 = extractEmbeddedZipBase64(html);
const zipBuf = Buffer.from(b64, "base64");

const summary = [];
for (const file of iterZipLocalFiles(zipBuf)) {
  if (!/^[0-9a-f]{20}\.json$/i.test(file.name)) continue;
  const json = JSON.parse(file.data.toString("utf8"));
  const failed = collectFailedTestsFromJson(json);
  if (failed.length > 0) summary.push({ shard: file.name, failed });
}

if (summary.length === 0) {
  console.log("No failed tests found in embedded report JSON shards.");
  process.exit(0);
}

for (const s of summary) {
  console.log(`--- ${s.shard} ---`);
  for (const f of s.failed) {
    console.log(`FAIL: ${f.title}`);
    const loc = f.location?.file ? `${f.location.file}:${f.location.line ?? "?"}` : "";
    if (loc) console.log(`  at: ${loc}`);
    for (const e of f.errors.slice(0, 3)) console.log(`  error: ${String(e).split(/\r?\n/)[0]}`);
  }
}

