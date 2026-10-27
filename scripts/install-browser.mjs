import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const result = spawnSync(
  process.execPath,
  ["node_modules/playwright/cli.js", "install", "chromium", "--only-shell"],
  {
    stdio: "inherit",
    env: {
      ...process.env,
      PLAYWRIGHT_BROWSERS_PATH: fileURLToPath(
        new URL("../.cache/ms-playwright", import.meta.url),
      ),
    },
  },
);
if (result.error) throw result.error;
process.exit(result.status ?? 1);
