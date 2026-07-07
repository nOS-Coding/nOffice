import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, "..");
const launcherDist = path.join(root, "apps", "noffice", "dist");

const subApps = ["nwrite", "nsheet", "nslides", "nimg", "ncode"];

for (const app of subApps) {
  const src = path.join(root, "apps", app, "dist");
  const dest = path.join(launcherDist, app);

  if (!fs.existsSync(src)) {
    console.warn(`Warning: ${src} does not exist, skipping ${app}`);
    continue;
  }

  fs.rmSync(dest, { recursive: true, force: true });
  fs.cpSync(src, dest, { recursive: true });
  console.log(`Copied ${app} dist → ${dest}`);
}
