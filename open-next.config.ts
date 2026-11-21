import { defineCloudflareConfig } from "@opennextjs/cloudflare";

// Every page here is per-viewer and dynamic, so no incremental cache is configured.
export default defineCloudflareConfig();
