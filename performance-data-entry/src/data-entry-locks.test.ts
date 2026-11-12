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
                organisationUnitId: "selected-vote",
                fallbackLocked: false,
            }),
        ).toBe(true);
        expect(
            isDataEntryColumnLocked({
                locks,
                dataSet,
                categoryOptionName: "Target",
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
                organisationUnitId: "selected-vote",
                fallbackLocked: true,
            }),
        ).toBe(true);
    });

    it("opens an unchecked first column when only the second column is locked", () => {
        const targetOnlyLocks: DataEntryLocks = {
            ...locks,
            rules: [{ ...locks.rules[0], columns: ["target"] }],
        };

        expect(
            isDataEntryColumnLocked({
                locks: targetOnlyLocks,
                dataSet,
                categoryOptionName: "Baseline",
                organisationUnitId: "selected-vote",
                fallbackLocked: true,
            }),
        ).toBe(false);
        expect(
            isDataEntryColumnLocked({
                locks: targetOnlyLocks,
                dataSet,
                categoryOptionName: "Target",
                organisationUnitId: "selected-vote",
                fallbackLocked: true,
            }),
        ).toBe(true);
    });

    it("locks Budget Approved without also locking Budget Planned", () => {
        const actionDataSet = { id: "actions", name: "Programme Actions" };
        const actionLocks: DataEntryLocks = {
            version: 1,
            rules: [
                {
                    id: "actions-default",
                    organisationUnitIds: [],
                    dataSetIds: [],
                    section: "actions",
                    columns: ["budgetApproved"],
                    mode: "locked",
                    enabled: true,
                    updatedAt: "2026-11-12T10:00:00.000Z",
                },
            ],
        };

        expect(
            isDataEntryColumnLocked({
                locks: actionLocks,
                dataSet: actionDataSet,
                categoryOptionName: "Budget Planned",
                organisationUnitId: "selected-vote",
                fallbackLocked: true,
            }),
        ).toBe(false);
        expect(
            isDataEntryColumnLocked({
                locks: actionLocks,
                dataSet: actionDataSet,
                categoryOptionName: "Budget Approved",
                organisationUnitId: "selected-vote",
                fallbackLocked: false,
            }),
        ).toBe(true);
    });
});
