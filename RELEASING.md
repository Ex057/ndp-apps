# Continuous Integration and Releases

## Builds for commits

The `CI` GitHub Actions workflow runs for every pull request to `main` and
every commit pushed to `main`. It installs the frozen Yarn dependencies, tests
Results Framework, Performance Data Entry, and the rollback tooling, then
builds both applications.

The deployable ZIPs are attached to the workflow run as GitHub artifacts for
30 days. These commit artifacts are test builds, not official releases.

## Create an official release

Official releases use a shared semantic version for both applications. Create
and push a tag after the intended commit has passed CI:

```sh
git tag v1.1.0
git push origin v1.1.0
```

The `Release` workflow validates the tag, applies version `1.1.0` to both app
packages in the GitHub runner, reruns all relevant tests, builds both ZIPs,
verifies their DHIS2 names and versions, generates `SHA256SUMS.txt`, and creates
the GitHub Release with generated release notes.

The version changes made by the workflow are build-time changes only; it does
not commit them back to `main`. Do not move or reuse a release tag. Create a
new patch tag, such as `v1.1.1`, if a release needs to be corrected.

## Roll back

For a local rollback, choose a dated ZIP from `build-history` as documented in
each app README. For an official rollback, open the required GitHub Release,
verify the ZIP against `SHA256SUMS.txt`, and upload that earlier ZIP through
DHIS2 App Management.

No DHIS2 credentials are stored in GitHub and these workflows do not deploy to
training or production automatically.
