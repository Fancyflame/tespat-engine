import { cpSync, existsSync, mkdirSync, rmSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const scriptDir = dirname(fileURLToPath(import.meta.url));
const projectRoot = resolve(scriptDir, "..");
const sourceDir = resolve(projectRoot, "node_modules/@tabler/icons/icons/outline");
const targetDir = resolve(projectRoot, "public/tabler-icons/outline");

if (!existsSync(sourceDir)) {
    throw new Error(`Tabler outline icons not found: ${sourceDir}`);
}

rmSync(targetDir, { recursive: true, force: true });
mkdirSync(targetDir, { recursive: true });
cpSync(sourceDir, targetDir, { recursive: true, force: true });
