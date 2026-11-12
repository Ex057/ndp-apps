import {
    classifyDataEntryColumn,
    getDataEntrySection,
    isDataEntryColumnLocked,
} from "./data-entry-locks";
import { DataEntryLocks } from "./types";

const dataSet = { id: "results-dataset", name: "NDPIV - Outputs" };

const locks: DataEntryLocks = {
    version: 1,
    rules: [
        {
            id: "results-default",
            reportingPeriod: "2026Q1",
            organisationUnitIds: ["selected-vote"],
            dataSetIds: [],
            section: "results",
            columns: ["baseline", "target"],
            mode: "locked",
            enabled: true,
            updatedAt: "2026-11-11T10:00:00.000Z",
        },
    ],
};

describe("data-entry lock policies", () => {
    it("classifies Results and Actions datasets and columns", () => {
        expect(getDataEntrySection(dataSet)).toBe("results");
        expect(
            getDataEntrySection({ id: "actions", name: "Programme Actions" }),
        ).toBe("actions");
        expect(classifyDataEntryColumn("Baseline", "results")).toBe(
            "baseline",
        );
        expect(classifyDataEntryColumn("Budget Approved", "actions")).toBe(
            "budgetApproved",
        );
    });

    it("locks only a Vote selected by the rule", () => {
        expect(
            isDataEntryColumnLocked({
                locks,
                dataSet,
                categoryOptionName: "Target",
                reportingPeriod: "2026Q1",
                organisationUnitId: "selected-vote",
                fallbackLocked: false,
            }),
        ).toBe(true);
        expect(
            isDataEntryColumnLocked({
                locks,
                dataSet,
                categoryOptionName: "Target",
                reportingPeriod: "2026Q1",
                organisationUnitId: "another-vote",
                fallbackLocked: false,
            }),
        ).toBe(false);
    });

    it("uses Open mode to override the positional fallback", () => {
        expect(
            isDataEntryColumnLocked({
                locks: {
                    ...locks,
                    rules: [{ ...locks.rules[0], mode: "open" }],
                },
                dataSet,
                categoryOptionName: "Baseline",
                reportingPeriod: "2026Q1",
                organisationUnitId: "selected-vote",
                fallbackLocked: true,
            }),
        ).toBe(false);
    });

    it("activates a scheduled lock only after its deadline", () => {
        const scheduledLocks: DataEntryLocks = {
            ...locks,
            rules: [
                {
                    ...locks.rules[0],
                    mode: "scheduled",
                    lockAt: "2026-11-11T10:00:00.000Z",
                },
            ],
        };
        const common = {
            locks: scheduledLocks,
            dataSet,
            categoryOptionName: "Target",
            reportingPeriod: "2026Q1",
            organisationUnitId: "selected-vote",
            fallbackLocked: true,
        };

        expect(
            isDataEntryColumnLocked({
                ...common,
                now: Date.parse("2026-11-11T09:59:00.000Z"),
            }),
        ).toBe(false);
        expect(
            isDataEntryColumnLocked({
                ...common,
                now: Date.parse("2026-11-11T10:01:00.000Z"),
            }),
        ).toBe(true);
    });

    it("retains the positional fallback when no rule matches", () => {
        expect(
            isDataEntryColumnLocked({
                locks,
                dataSet,
                categoryOptionName: "Actual",
                reportingPeriod: "2026Q1",
                organisationUnitId: "selected-vote",
                fallbackLocked: true,
            }),
        ).toBe(true);
    });
});
