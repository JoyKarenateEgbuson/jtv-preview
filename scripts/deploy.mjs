// Deploys to Cloudflare WITHOUT baking local secrets into the Worker.
//
// The Cloudflare build tool bundles any .env files it finds into the deployed code.
// Our local .env.local holds dev passwords and Google keys, so we hide those files
// during the build and put them back afterwards (even if the build fails or you
// press Ctrl+C). Production secrets live in Cloudflare (wrangler secret), not in the code.
import { existsSync, renameSync } from "node:fs";
import { spawnSync } from "node:child_process";

const envFiles = [".env.local", ".env.production.local", ".env.production", ".env"];
const held = envFiles.filter((f) => existsSync(f));

let restored = false;
function restore() {
  if (restored) return;
  restored = true;
  for (const f of held) if (existsSync(`${f}.held`)) renameSync(`${f}.held`, f);
}
process.on("exit", restore);
process.on("SIGINT", () => process.exit(130));
process.on("SIGTERM", () => process.exit(143));

for (const f of held) renameSync(f, `${f}.held`);
console.log(held.length ? `Hid ${held.join(", ")} for the build (restored after).` : "No local env files to hide.");

for (const step of ["build", "deploy"]) {
  const r = spawnSync("npx", ["opennextjs-cloudflare", step], { stdio: "inherit", shell: true });
  if (r.status !== 0) process.exit(r.status ?? 1);
}
