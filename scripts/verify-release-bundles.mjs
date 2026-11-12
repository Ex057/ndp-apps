import { execFileSync } from "node:child_process";
import { readdir } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import path from "node:path";

const EXPECTED_APPS = new Map([
    ["NDP Results Framework V2", "dhis-web-results-framework"],
    ["NDP Performance Data Entry V2", "performance-data-entry"],
]);

export function readManifest(zipPath) {
    let manifestText;
    try {
        manifestText = execFileSync(
            "unzip",
            ["-p", zipPath, "manifest.webapp"],
            { encoding: "utf8" },
        );
    } catch (error) {
        throw new Error(`Could not read manifest.webapp from ${zipPath}`, {
            cause: error,
        });
    }

    try {
        return JSON.parse(manifestText);
    } catch (error) {
        throw new Error(`Invalid manifest.webapp in ${zipPath}`, {
            cause: error,
        });
    }
}

export async function verifyReleaseBundles(version, assetsDirectory) {
    if (!/^\d+\.\d+\.\d+$/.test(version ?? "")) {
        throw new Error(`Invalid release version "${version ?? ""}"`);
    }

    const zipFiles = (await readdir(assetsDirectory))
        .filter((file) => file.toLowerCase().endsWith(".zip"))
        .sort();
    if (zipFiles.length !== EXPECTED_APPS.size) {
        throw new Error(
            `Expected ${EXPECTED_APPS.size} release ZIPs, found ${zipFiles.length}`,
        );
    }

    const foundApps = new Set();
    for (const zipFile of zipFiles) {
        const manifest = readManifest(path.join(assetsDirectory, zipFile));
        if (!EXPECTED_APPS.has(manifest.name)) {
            throw new Error(`Unexpected application "${manifest.name}"`);
        }
        if (manifest.version !== version) {
            throw new Error(
                `${manifest.name} has version ${manifest.version}; expected ${version}`,
            );
        }
        if (foundApps.has(manifest.name)) {
            throw new Error(`Duplicate application bundle: ${manifest.name}`);
        }
        foundApps.add(manifest.name);
    }

    return zipFiles;
}

const isMain =
    process.argv[1] &&
    path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);

if (isMain) {
    try {
        const [version, assetsDirectory] = process.argv.slice(2);
        const zipFiles = await verifyReleaseBundles(
            version,
            path.resolve(assetsDirectory ?? ""),
        );
        console.log(`Verified release bundles: ${zipFiles.join(", ")}`);
    } catch (error) {
        console.error(`Release verification failed: ${error.message}`);
        process.exitCode = 1;
    }
}
