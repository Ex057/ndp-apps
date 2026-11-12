import { execFileSync } from "node:child_process";
import { mkdtemp, mkdir, readFile, readdir, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import assert from "node:assert/strict";
import { archiveBuild } from "./archive-build.mjs";

async function createBundle(rootDir, workspace, name, version = "1.0.0") {
    const bundleDirectory = path.join(rootDir, workspace, "build", "bundle");
    const fixtureDirectory = path.join(rootDir, "fixture");
    await mkdir(bundleDirectory, { recursive: true });
    await mkdir(fixtureDirectory, { recursive: true });
    await writeFile(
        path.join(fixtureDirectory, "manifest.webapp"),
        JSON.stringify({ name, short_name: name, version }),
    );
    const zipPath = path.join(bundleDirectory, `${name}-${version}.zip`);
    execFileSync("zip", ["-q", zipPath, "manifest.webapp"], {
        cwd: fixtureDirectory,
    });
    return zipPath;
}

async function temporaryRepository() {
    return mkdtemp(path.join(os.tmpdir(), "ndp-rollback-test-"));
}

test("archives a valid bundle with matching metadata and checksum", async () => {
    const rootDir = await temporaryRepository();
    const sourcePath = await createBundle(
        rootDir,
        "dhis-web-results-framework",
        "NDP Results Framework V2",
    );
    const result = await archiveBuild("results", {
        rootDir,
        now: new Date("2026-11-12T09:10:11.123Z"),
        gitState: { commit: "abc12345", dirty: true },
    });

    assert.match(
        path.basename(result.archivePath),
        /2026-11-12_12-10-11-123_EAT--abc12345-dirty\.zip$/,
    );
    assert.deepEqual(await readFile(result.archivePath), await readFile(sourcePath));

    const archiveDirectory = path.dirname(result.archivePath);
    const index = JSON.parse(
        await readFile(path.join(archiveDirectory, "index.json"), "utf8"),
    );
    assert.equal(index.builds.length, 1);
    assert.equal(index.builds[0].name, "NDP Results Framework V2");
    assert.equal(index.builds[0].version, "1.0.0");
    assert.equal(index.builds[0].dirty, true);
    assert.match(
        await readFile(
            path.join(archiveDirectory, result.build.checksumFile),
            "utf8",
        ),
        new RegExp(result.build.sha256),
    );
});

test("retains only the ten newest builds for an app", async () => {
    const rootDir = await temporaryRepository();
    await createBundle(
        rootDir,
        "performance-data-entry",
        "NDP Performance Data Entry V2",
    );

    for (let index = 0; index < 11; index += 1) {
        await archiveBuild("performance", {
            rootDir,
            now: new Date(Date.UTC(2026, 10, 12, 9, 0, index)),
            gitState: { commit: "def67890", dirty: false },
        });
    }

    const archiveDirectory = path.join(
        rootDir,
        "build-history",
        "performance-data-entry",
    );
    const files = await readdir(archiveDirectory);
    assert.equal(files.filter((file) => file.endsWith(".zip")).length, 10);
    assert.equal(files.filter((file) => file.endsWith(".sha256")).length, 10);
    const index = JSON.parse(
        await readFile(path.join(archiveDirectory, "index.json"), "utf8"),
    );
    assert.equal(index.builds.length, 10);
    assert.equal(index.builds[0].builtAt, "2026-11-12T09:00:10.000Z");
});

test("fails when the bundle is missing or ambiguous", async () => {
    const missingRoot = await temporaryRepository();
    await assert.rejects(
        archiveBuild("results", {
            rootDir: missingRoot,
            gitState: { commit: "abc12345", dirty: false },
        }),
        /does not exist/,
    );

    const ambiguousRoot = await temporaryRepository();
    const firstZip = await createBundle(
        ambiguousRoot,
        "dhis-web-results-framework",
        "NDP Results Framework V2",
    );
    await writeFile(`${firstZip}.copy.zip`, await readFile(firstZip));
    await assert.rejects(
        archiveBuild("results", {
            rootDir: ambiguousRoot,
            gitState: { commit: "abc12345", dirty: false },
        }),
        /Expected exactly one ZIP.*found 2/,
    );
});

test("rejects a bundle with the wrong DHIS2 app identity", async () => {
    const rootDir = await temporaryRepository();
    await createBundle(
        rootDir,
        "dhis-web-results-framework",
        "Unexpected App",
    );

    await assert.rejects(
        archiveBuild("results", {
            rootDir,
            gitState: { commit: "abc12345", dirty: false },
        }),
        /Bundle identity mismatch/,
    );
});

test("rejects a bundle with a malformed manifest", async () => {
    const rootDir = await temporaryRepository();
    const bundleDirectory = path.join(
        rootDir,
        "performance-data-entry",
        "build",
        "bundle",
    );
    const fixtureDirectory = path.join(rootDir, "malformed-fixture");
    await mkdir(bundleDirectory, { recursive: true });
    await mkdir(fixtureDirectory, { recursive: true });
    await writeFile(
        path.join(fixtureDirectory, "manifest.webapp"),
        "not valid JSON",
    );
    execFileSync(
        "zip",
        ["-q", path.join(bundleDirectory, "malformed.zip"), "manifest.webapp"],
        { cwd: fixtureDirectory },
    );

    await assert.rejects(
        archiveBuild("performance", {
            rootDir,
            gitState: { commit: "def67890", dirty: false },
        }),
        /Invalid manifest\.webapp/,
    );
});
