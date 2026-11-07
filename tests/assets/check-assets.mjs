// Which files would Cloudflare publish as public static assets?
//
// Asks Wrangler itself: `wrangler deploy --dry-run` with debug logging lists every file it reads from the assets
// directory (the repo root, see wrangler.jsonc) and logs "Ignoring asset: <path>" for each one .assetsignore drops.
// Nothing is uploaded and no Cloudflare login is needed. Fails if dev tooling would be published, or if a page the
// site needs would be dropped.
//
//   npm run check:assets
import { spawnSync } from "node:child_process";
import { readFileSync, statSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..", "..");
// Pinned so the check is reproducible; Workers Builds runs `npx wrangler deploy` (latest) with the same .assetsignore rules.
const WRANGLER = "wrangler@4.158.0";

// Must never be public: dev tooling (PR-1) plus what .assetsignore already kept out.
const FORBIDDEN = [
  "package.json", "package-lock.json", "playwright.config.js",
  "tests/", ".github/", "node_modules/", "test-results/", "playwright-report/", "blob-report/",
  ".git/", ".gitignore", ".assetsignore", ".wrangler/", "api/", "README.md", "CLAUDE.md", "wrangler.jsonc"
];
// Must stay public, or the site breaks.
const REQUIRED = [
  "index.html", "classic/index.html", "os/index.html", "apps/trace.js",
  "images/wallpaper-komezuka.jpg", "images/wallpaper-komezuka-sm.jpg",
  "images/wallpaper-pixelverse-lakeside-night.png"
];

const run = spawnSync("npx", ["--yes", WRANGLER, "deploy", "--dry-run"], {
  cwd: ROOT,
  encoding: "utf8",
  maxBuffer: 64 * 1024 * 1024,
  env: { ...process.env, WRANGLER_LOG: "debug", WRANGLER_SEND_METRICS: "false", FORCE_COLOR: "0", NO_COLOR: "1" }
});
let out = (run.stdout || "") + "\n" + (run.stderr || "");
// Debug lines also go to Wrangler's log file; read it too in case the console output is trimmed.
const logPath = (out.match(/Writing logs to "([^"]+)"/) || [])[1];
if (logPath) { try { out += "\n" + readFileSync(logPath, "utf8"); } catch (e) {} }
out = out.replace(/\x1b\[[0-9;]*m/g, "");

if (run.status !== 0) {
  console.error(out.slice(-4000));
  console.error(`\n✗ wrangler deploy --dry-run exited with ${run.status}`);
  process.exit(1);
}

const lines = out.split(/\r?\n/);
const start = lines.findIndex((l) => /Read \d+ files from the assets directory/.test(l));
if (start < 0) { console.error("✗ Wrangler did not report the assets it read (output format changed?)"); process.exit(1); }
const readCount = +lines[start].match(/Read (\d+) files/)[1];
const read = new Set();
for (let i = start + 1; i < lines.length && lines[i].startsWith("/"); i++) read.add(lines[i].slice(1).trim());
const ignored = new Set(lines.filter((l) => l.startsWith("Ignoring asset: ")).map((l) => l.slice(16).trim()));

const isFile = (p) => { try { return statSync(join(ROOT, p)).isFile(); } catch (e) { return false; } };
const published = [...read].filter((p) => !ignored.has(p) && isFile(p)).sort();

const problems = [];
if (read.size !== readCount) problems.push(`Wrangler said it read ${readCount} entries but listed ${read.size}`);
if (ignored.size === 0) problems.push("Wrangler logged no ignored assets: is .assetsignore being read?");
for (const p of published) {
  const hit = FORBIDDEN.find((f) => f.endsWith("/") ? p.startsWith(f) : p === f);
  if (hit) problems.push(`would be PUBLISHED but must not be: ${p}  (rule: ${hit})`);
}
for (const p of REQUIRED) if (!published.includes(p)) problems.push(`would NOT be published but the site needs it: ${p}`);
// Dev tooling that exists in this checkout must have been seen and dropped by Wrangler, not merely absent.
for (const p of ["package.json", "package-lock.json", "playwright.config.js", "tests", ".github", "node_modules"]) {
  let exists = false; try { statSync(join(ROOT, p)); exists = true; } catch (e) {}
  if (exists && !ignored.has(p)) problems.push(`${p} exists but Wrangler did not log it as ignored`);
}

console.log(`Wrangler ${WRANGLER} dry run: read ${read.size} entries, ignored ${ignored.size}, would publish ${published.length} files:`);
for (const p of published) console.log("  + " + p);
if (problems.length) {
  console.error("\n✗ asset check failed:");
  for (const p of problems) console.error("  - " + p);
  process.exit(1);
}
console.log(`\n✓ no dev tooling, docs, config or API source is published; all ${REQUIRED.length} required pages are.`);
