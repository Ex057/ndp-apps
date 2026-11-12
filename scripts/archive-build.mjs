import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import {
    constants,
    copyFile,
    mkdir,
    readFile,
    readdir,
    rename,
    rm,
    writeFile,
} from "node:fs/promises";
import { fileURLToPath } from "node:url";
import path from "node:path";

const REPOSITORY_ROOT = path.resolve(
    path.dirname(fileURLToPath(import.meta.url)),
    "..",
);

const APP_CONFIG = {
    results: {
        workspace: "dhis-web-results-framework",
        expectedName: "NDP Results Framework V2",
    },
    performance: {
        workspace: "performance-data-entry",
        expectedName: "NDP Performance Data Entry V2",
    },
};

const RETENTION_LIMIT = 10;

function formatKampalaTimestamp(date) {
    const parts = new Intl.DateTimeFormat("en-GB", {
        timeZone: "Africa/Kampala",
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
        hour: "2-digit",
        minute: "2-digit",
        second: "2-digit",
        fractionalSecondDigits: 3,
        hourCycle: "h23",
    })
        .formatToParts(date)
        .reduce((current, part) => {
            current[part.type] = part.value;
            return current;
        }, {});

    return `${parts.year}-${parts.month}-${parts.day}_${parts.hour}-${parts.minute}-${parts.second}-${parts.fractionalSecond}_EAT`;
}

function safeFilename(value) {
    return value.replace(/[<>:"/\\|?*\u0000-\u001f]/g, "-");
}

function getGitState(rootDir) {
    const commit = execFileSync(
        "git",
        ["rev-parse", "--short=8", "HEAD"],
        {
            cwd: rootDir,
            encoding: "utf8",
        },
    ).trim();
    const status = execFileSync("git", ["status", "--porcelain"], {
        cwd: rootDir,
        encoding: "utf8",
    }).trim();

    return { commit, dirty: status.length > 0 };
}

async function sha256(filePath) {
    return createHash("sha256")
        .update(await readFile(filePath))
        .digest("hex");
}

function readBundleManifest(zipPath) {
    let manifestText;
    try {
        manifestText = execFileSync(
            "unzip",
            ["-p", zipPath, "manifest.webapp"],
            { encoding: "utf8" },
        );
    } catch (error) {
        throw new Error(
            `Could not read manifest.webapp from ${path.basename(zipPath)}`,
            { cause: error },
        );
    }

    try {
        return JSON.parse(manifestText);
    } catch (error) {
        throw new Error(
            `Invalid manifest.webapp in ${path.basename(zipPath)}`,
            { cause: error },
        );
    }
}

async function readIndex(indexPath) {
    try {
        const parsed = JSON.parse(await readFile(indexPath, "utf8"));
        if (!Array.isArray(parsed.builds)) {
            throw new Error("builds must be an array");
        }
        return parsed.builds;
    } catch (error) {
        if (error.code === "ENOENT") return [];
        throw new Error(`Could not read rollback index at ${indexPath}`, {
            cause: error,
        });
    }
}

async function writeIndex(indexPath, builds) {
    const temporaryPath = `${indexPath}.tmp`;
    await writeFile(
        temporaryPath,
        `${JSON.stringify({ version: 1, builds }, null, 2)}\n`,
    );
    await rename(temporaryPath, indexPath);
}

export async function archiveBuild(
    appKey,
    {
        rootDir = REPOSITORY_ROOT,
        now = new Date(),
        gitState = getGitState(rootDir),
        retentionLimit = RETENTION_LIMIT,
    } = {},
) {
    const config = APP_CONFIG[appKey];
    if (!config) {
        throw new Error(
            `Unknown app "${appKey}". Expected one of: ${Object.keys(APP_CONFIG).join(", ")}`,
        );
    }

    const bundleDirectory = path.join(
        rootDir,
        config.workspace,
        "build",
        "bundle",
    );
    let candidates;
    try {
        candidates = (await readdir(bundleDirectory)).filter((file) =>
            file.toLowerCase().endsWith(".zip"),
        );
    } catch (error) {
        if (error.code === "ENOENT") {
            throw new Error(`Build bundle directory does not exist: ${bundleDirectory}`);
        }
        throw error;
    }

    if (candidates.length !== 1) {
        throw new Error(
            `Expected exactly one ZIP in ${bundleDirectory}, found ${candidates.length}: ${candidates.join(", ") || "none"}`,
        );
    }

    const sourceFile = candidates[0];
    const sourcePath = path.join(bundleDirectory, sourceFile);
    const manifest = readBundleManifest(sourcePath);
    if (manifest.name !== config.expectedName) {
        throw new Error(
            `Bundle identity mismatch: expected "${config.expectedName}", found "${manifest.name ?? "missing name"}"`,
        );
    }
    if (typeof manifest.version !== "string" || manifest.version.length === 0) {
        throw new Error("Bundle manifest is missing a version");
    }

    const archiveDirectory = path.join(
        rootDir,
        "build-history",
        config.workspace,
    );
    await mkdir(archiveDirectory, { recursive: true });

    const timestamp = formatKampalaTimestamp(now);
    const dirtySuffix = gitState.dirty ? "-dirty" : "";
    const sourceBase = path.basename(sourceFile, path.extname(sourceFile));
    const archiveFile = safeFilename(
        `${sourceBase}--${timestamp}--${gitState.commit}${dirtySuffix}.zip`,
    );
    const archivePath = path.join(archiveDirectory, archiveFile);
    await copyFile(sourcePath, archivePath, constants.COPYFILE_EXCL);

    const sourceChecksum = await sha256(sourcePath);
    const archiveChecksum = await sha256(archivePath);
    if (sourceChecksum !== archiveChecksum) {
        await rm(archivePath, { force: true });
        throw new Error(`Checksum verification failed for ${archiveFile}`);
    }

    const checksumFile = `${archiveFile}.sha256`;
    await writeFile(
        path.join(archiveDirectory, checksumFile),
        `${archiveChecksum}  ${archiveFile}\n`,
    );

    const indexPath = path.join(archiveDirectory, "index.json");
    const existingBuilds = await readIndex(indexPath);
    const build = {
        app: appKey,
        workspace: config.workspace,
        name: manifest.name,
        version: manifest.version,
        builtAt: now.toISOString(),
        builtAtKampala: timestamp,
        gitCommit: gitState.commit,
        dirty: gitState.dirty,
        sourceFile,
        archiveFile,
        checksumFile,
        sha256: archiveChecksum,
    };
    const sortedBuilds = [...existingBuilds, build].sort(
        (left, right) =>
            new Date(right.builtAt).getTime() -
            new Date(left.builtAt).getTime(),
    );
    const retainedBuilds = sortedBuilds.slice(0, retentionLimit);
    const removedBuilds = sortedBuilds.slice(retentionLimit);

    for (const removed of removedBuilds) {
        for (const file of [removed.archiveFile, removed.checksumFile]) {
            if (file && path.basename(file) === file) {
                await rm(path.join(archiveDirectory, file), { force: true });
            }
        }
    }
    await writeIndex(indexPath, retainedBuilds);

    return { archivePath, build, removedBuilds };
}

function parseAppArgument(argv) {
    const appFlag = argv.indexOf("--app");
    return appFlag >= 0 ? argv[appFlag + 1] : undefined;
}

const isMain =
    process.argv[1] &&
    path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);

if (isMain) {
    try {
        const appKey = parseAppArgument(process.argv.slice(2));
        const result = await archiveBuild(appKey);
        console.log(`Rollback archive created: ${result.archivePath}`);
    } catch (error) {
        console.error(`Rollback archive failed: ${error.message}`);
        process.exitCode = 1;
    }
}
