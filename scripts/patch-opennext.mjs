// Next.js 16.4 reads `.next/server/preview-props.json` at startup, but
// @opennextjs/cloudflare 1.20.x only inlines files matching *-manifest.json,
// so the Worker crashed with "Unexpected loadManifest(...preview-props.json)".
// Add it to the adapter's list. Runs on `npm install` (incl. Cloudflare builds);
// it does nothing once a fixed adapter version no longer has the old pattern.
import { readFileSync, writeFileSync, existsSync } from "node:fs";

const file = "node_modules/@opennextjs/cloudflare/dist/cli/build/patches/plugins/load-manifest.js";
const before = "{*-manifest,required-server-files,prefetch-hints}.json";
const after = "{*-manifest,required-server-files,prefetch-hints,preview-props}.json";

if (!existsSync(file)) {
  console.log("patch-opennext: adapter not installed, skipped");
} else {
  const src = readFileSync(file, "utf8");
  if (src.includes(after)) console.log("patch-opennext: already applied");
  else if (src.includes(before)) {
    writeFileSync(file, src.replace(before, after));
    console.log("patch-opennext: preview-props.json will be bundled");
  } else console.log("patch-opennext: pattern not found (adapter changed), skipped");
}
