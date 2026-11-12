import { readFile, writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import path from "node:path";

const REPOSITORY_ROOT = path.resolve(
    path.dirname(fileURLToPath(import.meta.url)),
    "..",
);
const RELEASE_WORKSPACES = [
    "dhis-web-results-framework",
    "performance-data-entry",
];

export function validateReleaseVersion(version) {
    if (!/^\d+\.\d+\.\d+$/.test(version ?? "")) {
        throw new Error(
            `Invalid release version "${version ?? ""}". Expected MAJOR.MINOR.PATCH, for example 1.1.0`,
        );
    }
}

export async function setReleaseVersion(
    version,
    { rootDir = REPOSITORY_ROOT } = {},
) {
    validateReleaseVersion(version);

    for (const workspace of RELEASE_WORKSPACES) {
        const packagePath = path.join(rootDir, workspace, "package.json");
        const packageJson = JSON.parse(await readFile(packagePath, "utf8"));
        packageJson.version = version;
        await writeFile(packagePath, `${JSON.stringify(packageJson, null, 4)}\n`);
    }
}

const isMain =
    process.argv[1] &&
    path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);

if (isMain) {
    try {
        const version = process.argv[2];
        await setReleaseVersion(version);
        console.log(`Application release version set to ${version}`);
    } catch (error) {
        console.error(`Could not set release version: ${error.message}`);
        process.exitCode = 1;
    }
}
