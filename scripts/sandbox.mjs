// A safe local copy of the site: no Google, no live data. Videos and comments are
// stored in the git-ignored .data folder, with a throwaway password.
//
//   npm run sandbox      ->  http://localhost:3200   (password: sandbox)
import { spawn } from "node:child_process";

const child = spawn("npx", ["next", "dev", "-p", "3200"], {
  stdio: "inherit",
  shell: true,
  env: {
    ...process.env,
    JTV_LOCAL: "1",
    ADMIN_PASSWORD: "sandbox",
    SESSION_SECRET: "sandbox-secret-not-for-production",
  },
});
console.log("\nSandbox: http://localhost:3200/admin  (password: sandbox). Uses local files only, never your live site.\n");
child.on("exit", (code) => process.exit(code ?? 0));
