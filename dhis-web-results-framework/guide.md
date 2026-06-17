# NDP Results Framework Local Development Guide

## Local Runtime

Use `yarn start` from `dhis-web-results-framework` for normal local testing.

The local runtime uses two ports:

- `http://localhost:3000` serves the app shell and your local source changes.
- `http://localhost:8080` is the local DHIS2 API proxy used by the app adapter.

The default command is safe for local work because `yarn start` runs `yarn start:train`, which proxies to:

```text
https://train.ndpme.go.ug/ndpdb
```

Production is only used when you intentionally run:

```bash
yarn start:prod
```

For Policy Actions testing, use:

```text
http://localhost:3000/#/ndp/policy-actions?v=NDPIV
```

If the app shows `Failed to fetch user ID`, restart the dev server with `yarn start` and check that the browser request to `/api/me` is going through the local proxy.

## Route and Version Handling

The app uses TanStack Router with hash routes. NDP pages expect a search parameter named `v`, for example `v=NDPIV`.

Relevant files:

- `src/types.ts` defines search schemas such as `NDPValidator`.
- `src/routes/layout/route.tsx` owns the main NDP layout and redirects missing `v` to the latest NDP version.
- `src/routes/layout/ndp/route.tsx` loads NDP indicator data once `v` exists.

The route fix makes direct links like `/ndp/policy-actions` safer by adding the latest available NDP version instead of showing a Zod validation error.

## Policy Actions Page

Relevant files:

- `src/routes/layout/ndp/policy-actions/route.tsx` defines the Policy Actions parent route and layout shell.
- `src/routes/layout/ndp/policy-actions/index.tsx` renders the page UI.
- `src/query-options.ts` contains the DHIS2 queries for tracker programs, tracker metadata, tracker line lists, and org-unit hierarchy.
- `src/types.ts` contains the tracker line-list and option types used by the page.

The Policy Actions page currently supports:

- Selecting a tracker programme.
- Filtering by MDA from a lazily-loaded org-unit hierarchy.
- Clearing the MDA filter to return the report to all configured MDAs.
- Displaying tracker line-list rows across all available API pages.
- Exporting rows to Excel or CSV.
- Switching programmes while the report is displayed; the table reloads using the newly selected programme.
- Changing the MDA filter while the report is displayed; the table reloads using the selected MDA.

The programme dropdown is metadata-driven:

- It fetches DHIS2 tracker programmes with registration.
- It auto-detects Policy Actions programmes from tracker programme metadata and naming.
- If no clear Policy Actions programme is detected, it falls back to showing all tracker programmes with registration so the page does not block local testing.

Policy Actions table columns are driven by tracker programme metadata:

- The first column is a generated `Vote` column from the tracker row's org unit name.
- Tracked entity attributes are shown only when the programme attribute is configured with `displayInList`.
- Program stage data elements are shown only when the program stage data element is configured with `displayInReports`.
- Metadata `sortOrder` is respected so columns follow the configured order.
- This gives a profile-first representation: org unit first, tracked entity profile fields next, followed by explicitly reportable programme/event fields.

The table presentation is intentionally handled separately from the data query:

- `createColumns` in `src/routes/layout/ndp/policy-actions/index.tsx` maps each metadata item into an Ant Design table column.
- `getColumnWidth` keeps common report fields readable. Long fields such as policy action/directive and remarks get wider columns; short fields such as priority, delayed, and action ID stay compact.
- `getCellHighlightStyle` applies old-report-style color cues for priority, progress status, performance rating, and delayed status.
- `.policy-actions-table` in `src/app.css` controls the compact bordered report layout, wrapped headers, wrapped cell text, and stable table borders.

If a programme appears to show columns in the wrong order, first confirm the programme metadata sort order in DHIS2. The React table follows the profile metadata order; it should not hardcode one universal column order for every tracker programme.

The MDA filter hierarchy is rooted at the app's existing default org-unit context from the DHIS2 user/data-view setup. The modal loads the detected root and initial child org units, then lazily loads descendants when a node is expanded. Before a user picks an MDA, the report query uses that detected root with `ouMode=DESCENDANTS`. After a user picks an MDA, the report query uses the selected MDA with `ouMode=DESCENDANTS`. Clearing the MDA filter returns to the detected root.

The hierarchy query also includes ancestors above the filter root, so users can see top-level context such as Uganda above Central Government. Ancestor nodes above the configured MDA root are visible but disabled to avoid accidentally broadening the report beyond the intended MDA filter scope.

Organisation units are sorted client-side within each parent node by display title. The tracker read endpoint does not provide a reliable org-unit-name sort for this tree.

## Tracker API Notes

Policy Actions reads tracker data with the deprecated tracker read endpoint because this project currently targets DHIS2 `2.40.1`, where `/api/tracker/trackedEntities` is returning conflicts for these line-list reads:

```text
GET /api/trackedEntityInstances.json
```

The read query uses the deprecated endpoint parameter names:

- `program`
- `ou` and `ouMode=DESCENDANTS`
- `page` and `pageSize`
- `fields`

The page reads all available tracker pages by incrementing `page` until the API pager's `pageCount` is reached. It does not use `skipPaging=true` or `paging=false`, because those can hit DHIS2 tracker collection limits.

When the target DHIS2 instance is upgraded past the affected 2.40.1 behavior, this can be migrated back to `/api/tracker/trackedEntities` with `orgUnits` and `orgUnitMode`.

`POST /api/tracker` is for tracker imports. The Policy Actions page only reads data, so it should not use that import endpoint.

If the table shows no rows after selecting a programme:

1. Open the browser Network tab.
2. Find the `/api/trackedEntityInstances.json` request.
3. Confirm the request contains `program`, `ou`, and `ouMode`.
4. If the request is red or returns a non-2xx status, the API query failed.
5. If the request succeeds but `trackedEntities` is empty, the selected programme/org-unit scope has no matching tracker data.

## Replacing Placeholder `Index` Pages

Some routes still render a placeholder like:

```tsx
return <div>Index</div>;
```

To improve one of those pages:

1. Find the route with `rg "<div>Index</div>" src/routes`.
2. Open that route's `index.tsx` and its sibling `route.tsx`.
3. Check the route's search schema in `src/types.ts`.
4. Reuse existing query helpers from `src/query-options.ts` where possible.
5. Keep the parent route focused on layout and validation.
6. Put page UI, filters, tables, and export actions in `index.tsx`.
7. Run `yarn build` before testing in the browser.

Prefer matching nearby NDP pages instead of creating a new pattern from scratch.

## Verification Checklist

After changing a page:

1. Run `yarn build`.
2. Restart `yarn start` if script or environment behavior changed.
3. Open the page on `localhost:3000`.
4. Confirm the URL includes the expected `v` search parameter.
5. Confirm the browser Network tab shows DHIS2 API calls going through the local proxy.
6. Confirm the page does not still show `Index`.
