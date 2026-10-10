import { defineCloudflareConfig } from "@opennextjs/cloudflare";

// Defaults suit RyannReceipt: pages are static shells, data lives in Supabase
// behind small API routes, and images are rendered in the browser.
export default defineCloudflareConfig();
