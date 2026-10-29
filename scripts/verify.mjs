// Automated checks from docs/SUBMISSION.md: secrets, forbidden files, repo size, bundle budget.
// Usage: node scripts/verify.mjs   (run `npm run build` first for the bundle check)
import { execFileSync } from "node:child_process";
import { existsSync, readFileSync, statSync } from "node:fs";
import { gzipSync } from "node:zlib";

const MAX_TRACKED_BYTES = 8 * 1024 * 1024;
const MAX_IMAGE_BYTES = 200 * 1024;
const MAX_INITIAL_JS_GZIP = 200 * 1024;
const KEY_PATTERN = /AIza[0-9A-Za-z_-]{35}|AQ\.[0-9A-Za-z_-]{40,}/;
const FORBIDDEN = [
  /(^|\/)node_modules\//,
  /^dist\//,
  /^coverage\//,
  /^\.wrangler\//,
  /^playwright-report\//,
  /^test-results\//,
  /(^|\/)\.dev\.vars$/,
  /(^|\/)\.env(?!\.example$)/,
  /\.(mp4|mov|webm|avi)$/i,
];

const failures = [];
const files = execFileSync("git", ["ls-files", "-z"], { encoding: "utf8" })
  .split("\0")
  .filter((f) => f && existsSync(f));

let total = 0;
for (const file of files) {
  const size = statSync(file).size;
  total += size;
  if (FORBIDDEN.some((re) => re.test(file))) failures.push(`Forbidden file is tracked: ${file}`);
  if (/\.(png|jpe?g|gif|webp)$/i.test(file) && size > MAX_IMAGE_BYTES) {
    failures.push(`Image over 200 KB: ${file}`);
  }
  if (size < 2_000_000 && !/\.(png|jpe?g|gif|webp|ico)$/i.test(file)) {
    if (KEY_PATTERN.test(readFileSync(file, "utf8"))) failures.push(`Possible API key in ${file}`);
  }
}
if (total > MAX_TRACKED_BYTES) failures.push(`Tracked files are ${total} bytes (limit 8 MB)`);

let bundle = "skipped (no dist/; run npm run build)";
if (existsSync("dist/index.html")) {
  const entry = readFileSync("dist/index.html", "utf8").match(/assets\/index-[^"]+\.js/)?.[0];
  if (entry) {
    const gz = gzipSync(readFileSync(`dist/${entry}`)).length;
    bundle = `${(gz / 1024).toFixed(1)} KB gzip`;
    if (gz > MAX_INITIAL_JS_GZIP) failures.push(`Initial JS is ${bundle} (limit 200 KB)`);
  }
  for (const f of execFileSync("git", ["ls-files", "--others", "-z", "dist"], { encoding: "utf8" })
    .split("\0")
    .filter(Boolean)) {
    if (f.endsWith(".js") && KEY_PATTERN.test(readFileSync(f, "utf8"))) {
      failures.push(`Possible API key in built file ${f}`);
    }
  }
}

const out = (line) => process.stdout.write(`${line}\n`);
out(`Tracked files: ${files.length}, ${(total / 1024).toFixed(0)} KB`);
out(`Initial JS: ${bundle}`);
if (failures.length > 0) {
  for (const f of failures) out(`FAIL ${f}`);
  process.exit(1);
}
out("All submission checks passed.");
