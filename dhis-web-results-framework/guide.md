# NDP Results Framework Developer Guide

## Quick Start

Use these commands from `dhis-web-results-framework`:

```bash
yarn start
yarn build
```

Local runtime:

- `http://localhost:3000` serves the local frontend.
- `http://localhost:8080` is the DHIS2 proxy used by the app adapter.

Default local target:

```text
https://train.ndpme.go.ug/ndpdb
```

Production proxy is only used with:

```bash
yarn start:prod
```

## How The App Is Organized

Top-level source folders:

- `src/routes` contains route definitions and page entry points.
- `src/components` contains reusable UI pieces such as filters, org-unit pickers, legends, and shared report fragments.
- `src/query-options.ts` contains the main DHIS2 query builders and data-loading rules.
- `src/types.ts` contains route validators, DTOs, tracker metadata types, and shared report typing.
- `src/utils` contains local utilities, including export helpers and formatting helpers.
- `src/app.css` contains shared page-level report styling.

The NDP pages live under:

```text
src/routes/layout/ndp
```

Each feature usually has:

- `route.tsx` for route registration, layout, and search validation wiring
- `index.tsx` for page UI, filters, table rendering, exports, and page-specific state

## Where To Edit What

### 1. Page Layout And Filters

Edit the page `index.tsx` file.

Examples:

- `src/routes/layout/ndp/policy-actions/index.tsx`
- `src/routes/layout/ndp/project-performances/index.tsx`
- `src/routes/layout/ndp/output-performance/index.tsx`

Use this layer for:

- cards
- headers
- advanced filter layout
- tables
- footer behavior
- empty states
- export button placement

### 2. Route Behavior And Search Params

Edit:

- `src/routes/layout/route.tsx`
- `src/routes/layout/ndp/route.tsx`
- feature `route.tsx` files
- `src/types.ts`

Use this layer for:

- redirect logic
- default `v` handling
- route search schema validation
- page registration in the app shell

### 3. DHIS2 Data Queries

Edit:

- `src/query-options.ts`

Use this file for:

- analytics requests
- tracker metadata queries
- tracker line-list queries
- organisation unit loading
- fallback logic for user org-unit scope

If a page loads the wrong rows, throws a tracker error, or shows the wrong org units, start here.

### 4. Reusable UI Components

Edit:

- `src/components/organisation.tsx`
- `src/components/Filter.tsx`
- `src/components/period-selector.tsx`
- `src/components/results.tsx`
- `src/components/performance.tsx`

Use this layer for:

- shared org-unit selectors
- shared advanced filter shells
- period transfer widgets
- reusable table/export blocks
- shared scorecard visuals

### 5. Report Styling

Edit:

- `src/app.css`

Use this file for:

- shared table styling
- sticky layout behavior
- footer positioning
- consistent card spacing
- responsive adjustments

Prefer reusing the established green/blue filter card colors and `3px` radius used across the existing NDP filter components.

### 6. Export Logic

Edit:

- `src/utils/tracker-report-export.ts`
- `src/components/results.tsx`
- legacy helpers only if still referenced elsewhere

Current tracker exports should use:

- `exceljs`
- `jspdf`
- `jspdf-autotable`

Do not scrape colors from rendered cells for tracker exports. Build export data directly from visible columns and rows.

## Page Patterns To Reuse

### Filter Card Pattern

Reference:

- `src/components/Filter.tsx`

Use this when you need:

- left programme/filter card in green
- right advanced filter card in blue
- consistent borders and radius
- the standard collapse affordance

### Tracker Line-List Pattern

Reference:

- `src/routes/layout/ndp/policy-actions/index.tsx`
- `src/routes/layout/ndp/project-performances/index.tsx`

Use this when you need:

- tracker programme selection
- org-unit filtering
- dynamic metadata-driven columns
- sticky header region
- custom footer pagination
- direct Excel/PDF export of visible rows

### Analytics Report Pattern

Reference:

- `src/components/results.tsx`
- `src/routes/layout/ndp/output-performance/index.tsx`
- `src/routes/layout/ndp/outcome-performance/index.tsx`

Use this when you need:

- quarter-based performance tables
- legend blocks
- export buttons above the table
- dense analytical table layouts

## Tracker Pages: How They Work

Tracker pages typically follow this flow:

1. Load tracker programmes.
2. Auto-select or let the user select a programme.
3. Load tracker metadata for that programme.
4. Build table columns from metadata.
5. Load tracker rows for the selected org-unit scope.
6. Render exports from the same visible columns and rows.

Key files:

- `src/query-options.ts`
- `src/routes/layout/ndp/policy-actions/index.tsx`
- `src/routes/layout/ndp/project-performances/index.tsx`
- `src/utils/tracker-report-export.ts`

## Org Unit Behavior

The org-unit selector behavior is centered in:

- `src/components/organisation.tsx`
- `src/query-options.ts`

Important rules:

- Default attached org unit comes from the root loader context.
- User switching can expose cache problems if org-unit trees are not reloaded cleanly.
- Tracker queries should fall back safely when user scope is limited.
- If the user should see their assigned vote by default, initialize page state from the root loader `ou`.

## If You Need To Add A New Report

Use this sequence:

1. Create or update the feature folder under `src/routes/layout/ndp/<feature-name>`.
2. Register its route in the appropriate parent route file.
3. Add search validation in `src/types.ts` if the page needs route params.
4. Reuse an existing query option from `src/query-options.ts` where possible.
5. Reuse `Filter.tsx`, `OrgUnitSelect`, or `results.tsx` patterns instead of starting from scratch.
6. Keep query logic out of generic UI components unless the component is already responsible for that behavior.
7. Run `yarn build` before testing in the browser.

## If A Page Still Shows `Index`

Find placeholders with:

```bash
rg "<div>Index</div>" src/routes
```

Then:

1. Open that route's `index.tsx`.
2. Open the sibling `route.tsx`.
3. Check the relevant validator in `src/types.ts`.
4. Reuse a nearby NDP page pattern.
5. Keep layout wiring in `route.tsx` and actual report UI in `index.tsx`.

## Debugging Checklist

If the page fails to load:

1. Confirm you are on `localhost:3000`, not `8080`.
2. Check `/api/me` and `/api/system/info` through the local app.
3. Confirm the route URL includes required params such as `v=NDPIV`.
4. Check the browser Network tab for failing DHIS2 requests.

If a tracker table is empty:

1. Confirm a tracker programme is selected.
2. Check the tracker line-list request in Network.
3. Confirm the selected org unit is in the user’s scope.
4. Check metadata ordering and display flags in DHIS2.

If an export fails:

1. Confirm the visible columns are present.
2. Confirm there are rows in the current filtered dataset.
3. Check the browser console for export mapping errors.
4. Start with `src/utils/tracker-report-export.ts`.

## Recommended Local Verification

After making changes:

1. Run `yarn build`.
2. Restart `yarn start` if route or environment behavior changed.
3. Test on `localhost:3000`.
4. Check both desktop and narrow widths.
5. Verify table scroll, sticky areas, exports, and default org-unit behavior.

## Git Note

`guide.md` is already listed in the repo-level `.gitignore`, but because it has been tracked before, Git will still show modifications until it is explicitly removed from the index.

If you want it ignored going forward without deleting your local file:

```bash
git rm --cached dhis-web-results-framework/guide.md
```
