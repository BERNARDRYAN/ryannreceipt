// Fails when the Cloudflare Worker bundle is too big for the free plan
// (3 MiB gzipped). Run after `npm run cf:build`.
import { execSync } from "node:child_process";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const LIMIT_KIB = 3072;
const WARN_KIB = 2950;

const outdir = mkdtempSync(join(tmpdir(), "rr-worker-"));
try {
  const out = execSync(`npx wrangler deploy --dry-run --outdir "${outdir}"`, { encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] });
  const match = /gzip:\s*([\d.]+)\s*KiB/.exec(out);
  if (!match) throw new Error(`Couldn't read the bundle size from wrangler:\n${out}`);
  const kib = Number(match[1]);
  const left = (LIMIT_KIB - kib).toFixed(0);
  if (kib > LIMIT_KIB) {
    console.error(`✖ Worker is ${kib} KiB gzipped, over the free plan's ${LIMIT_KIB} KiB.`);
    process.exit(1);
  }
  console.log(`${kib > WARN_KIB ? "⚠" : "✔"} Worker is ${kib} KiB gzipped (${left} KiB under the ${LIMIT_KIB} KiB limit).`);
} finally {
  rmSync(outdir, { recursive: true, force: true });
}
