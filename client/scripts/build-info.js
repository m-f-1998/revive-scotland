import { writeFile, mkdir, readFile } from "fs/promises";
import { join } from "path";
import { fileURLToPath } from "url";

const __dirname = fileURLToPath(new URL(".", import.meta.url));
const packageJsonPath = join(__dirname, "../package.json");
const envFolderPath = join(__dirname, "../src/environments");
const envFilePath = join(envFolderPath, "environment.prod.ts");

// Read package.json
const packageJson = JSON.parse(await readFile(packageJsonPath, "utf-8"));

// Prepare build info
const buildInfo = {
  version: packageJson.version,
  lastUpdated: new Date().toISOString(),
};

// Convert JSON to formatted TypeScript export
const content = `export const environment = ${JSON.stringify(buildInfo, null, 2)};`;

try {
  // Ensure environments directory exists
  await mkdir(envFolderPath, { recursive: true });

  // Write to environment file
  await writeFile(envFilePath, content);
  console.log("Updated environment.prod.ts with version and build info:", buildInfo);
} catch (error) {
  console.error("Failed to update environment file:", error);
}
