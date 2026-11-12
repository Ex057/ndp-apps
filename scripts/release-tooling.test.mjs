import { execFileSync } from "node:child_process";
import { mkdtemp, mkdir, readFile, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import assert from "node:assert/strict";
import {
    setReleaseVersion,
    validateReleaseVersion,
} from "./set-release-version.mjs";
import { verifyReleaseBundles } from "./verify-release-bundles.mjs";

async function temporaryDirectory() {
    return mkdtemp(path.join(os.tmpdir(), "ndp-release-test-"));
}

async function createBundle(directory, filename, name, version) {
    const fixtureDirectory = path.join(directory, `${filename}-fixture`);
    await mkdir(fixtureDirectory, { recursive: true });
    await writeFile(
        path.join(fixtureDirectory, "manifest.webapp"),
        JSON.stringify({ name, short_name: name, version }),
    );
    execFileSync(
        "zip",
        ["-q", path.join(directory, filename), "manifest.webapp"],
        { cwd: fixtureDirectory },
    );
}

test("sets the same semantic version for both released applications", async () => {
    const rootDir = await temporaryDirectory();
    for (const workspace of [
        "dhis-web-results-framework",
        "performance-data-entry",
    ]) {
        await mkdir(path.join(rootDir, workspace), { recursive: true });
        await writeFile(
            path.join(rootDir, workspace, "package.json"),
            JSON.stringify({ name: workspace, version: "1.0.0" }),
        );
    }

    await setReleaseVersion("1.2.3", { rootDir });

    for (const workspace of [
        "dhis-web-results-framework",
        "performance-data-entry",
    ]) {
        const packageJson = JSON.parse(
            await readFile(path.join(rootDir, workspace, "package.json")),
        );
        assert.equal(packageJson.version, "1.2.3");
    }
});

test("rejects non-semantic release versions", () => {
    assert.throws(() => validateReleaseVersion("v1.2.3"), /Invalid release/);
    assert.throws(() => validateReleaseVersion("1.2"), /Invalid release/);
});

test("verifies both release identities and versions", async () => {
    const assetsDirectory = await temporaryDirectory();
    await createBundle(
        assetsDirectory,
        "results.zip",
        "NDP Results Framework V2",
        "2.0.1",
    );
    await createBundle(
        assetsDirectory,
        "performance.zip",
        "NDP Performance Data Entry V2",
        "2.0.1",
    );

    const bundles = await verifyReleaseBundles("2.0.1", assetsDirectory);
    assert.deepEqual(bundles, ["performance.zip", "results.zip"]);
});

test("rejects release bundles with a mismatched version", async () => {
    const assetsDirectory = await temporaryDirectory();
    await createBundle(
        assetsDirectory,
        "results.zip",
        "NDP Results Framework V2",
        "1.0.0",
    );
    await createBundle(
        assetsDirectory,
        "performance.zip",
        "NDP Performance Data Entry V2",
        "1.0.1",
    );

    await assert.rejects(
        verifyReleaseBundles("1.0.1", assetsDirectory),
        /has version 1\.0\.0; expected 1\.0\.1/,
    );
});
