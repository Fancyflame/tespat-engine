import {
    existsSync,
    mkdirSync,
    readdirSync,
    readFileSync,
    rmSync,
    writeFileSync,
} from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const scriptDir = dirname(fileURLToPath(import.meta.url));
const projectRoot = resolve(scriptDir, "..");
const sourceDir = resolve(projectRoot, "node_modules/@tabler/icons/icons/outline");
const targetDir = resolve(projectRoot, "public/tabler-icons");
const targetFile = resolve(targetDir, "outline.json");

if (!existsSync(sourceDir)) {
    throw new Error(`Tabler outline icons not found: ${sourceDir}`);
}

const manifest = Object.create(null);
const sourceFiles = readdirSync(sourceDir, { withFileTypes: true })
    .filter((entry) => entry.isFile() && entry.name.endsWith(".svg"))
    .sort((left, right) => left.name.localeCompare(right.name));

for (const entry of sourceFiles) {
    const iconName = entry.name.slice(0, -4);
    const svg = readFileSync(resolve(sourceDir, entry.name), "utf8");
    manifest[iconName] = svg;
}

rmSync(targetDir, { recursive: true, force: true });
mkdirSync(targetDir, { recursive: true });
writeFileSync(targetFile, JSON.stringify(manifest));
